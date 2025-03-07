const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3000;
const STORAGE_DIR = "uploads";

// Middleware for parsing form data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ensure storage directory exists
if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

// Multer storage configuration for versioning
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = STORAGE_DIR;
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        if (!file || !file.originalname) {
            return cb(new Error("Invalid file upload"));
        }
        const uploadPath = STORAGE_DIR;
        const ext = path.extname(file.originalname);
        const baseName = path.basename(file.originalname, ext);

        const existingFiles = fs.readdirSync(uploadPath)
            .filter(f => f.startsWith(baseName) && f.endsWith(ext));

        let version = 1;
        if (existingFiles.length > 0) {
            const versionNumbers = existingFiles.map(f => {
                const match = f.match(/_v(\d+)\./);
                return match ? parseInt(match[1], 10) : 0;
            });
            version = Math.max(...versionNumbers) + 1;
        }

        const newFileName = `${baseName}_v${version}${ext}`;
        console.log("Generated filename:", newFileName);

        cb(null, newFileName);
    }
});

const upload = multer({ storage });


// Upload Route
app.post("/upload", upload.single("file"), (req, res) => {
    console.log("File received:", req.file); // Debugging log
    let { userId, category } = req.body;
    userId = userId || "defaultUser";
    category = category || "uncategorized";

    if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
    }
    const uploadPath = path.join(STORAGE_DIR, userId, category);

    if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
    }

    // ✅ Move file to correct directory
    const newFilePath = path.join(uploadPath, req.file.filename);
    fs.renameSync(req.file.path, newFilePath);

    res.json({
        message: "File uploaded successfully!",
        file: {
            fileName: req.file.filename,
            path: req.file.path,
            uploadedAt: new Date()
        }
    });
});


// 🟢 Get Latest Version of a File
app.get("/files/latest", (req, res) => {
    const { userId, category, fileName } = req.query;

    if (!userId || !category || !fileName) {
        return res.status(400).json({ error: "Missing required query parameters" });
    }

    const dirPath = path.join(STORAGE_DIR, userId, category);
    if (!fs.existsSync(dirPath)) {
        return res.status(404).json({ error: "No files found" });
    }

    // Get all versions of the file
    const existingFiles = fs.readdirSync(dirPath)
        .filter(f => f.startsWith(fileName.split('.')[0]) && f.endsWith(path.extname(fileName)));

    if (existingFiles.length === 0) {
        return res.status(404).json({ error: "File not found" });
    }

    // Sort by version number
    existingFiles.sort((a, b) => {
        const versionA = parseInt(a.match(/_v(\d+)\./)[1], 10);
        const versionB = parseInt(b.match(/_v(\d+)\./)[1], 10);
        return versionB - versionA; // Latest first
    });

    res.json({
        latestFile: existingFiles[0],
        path: path.join(dirPath, existingFiles[0])
    });
});

// 🟢 Get Specific Version of a File
app.get("/files/version", (req, res) => {
    const { userId, category, fileName, version } = req.query;

    if (!userId || !category || !fileName || !version) {
        return res.status(400).json({ error: "Missing required query parameters" });
    }

    const dirPath = path.join(STORAGE_DIR, userId, category);
    const baseName = fileName.split('.')[0]; // Remove extension
    const ext = path.extname(fileName);
    const fullFileName = `${baseName}_v${version}${ext}`;

    const filePath = path.join(dirPath, fullFileName);
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "File version not found" });
    }

    res.json({
        file: fullFileName,
        path: filePath
    });
});

// 🟢 Start Server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});


