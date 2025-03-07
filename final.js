const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = 3000;

app.use(express.json());

// 📂 Base directory for file storage
const STORAGE_DIR = path.join(__dirname, "uploads");

// ✅ Ensure base directory exists
if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

// 📌 Multer Storage Configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // ⚠️ `req.body` is only available AFTER multer processes the request
        const uploadPath = STORAGE_DIR; // Default path, updated inside route

        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        if (!file || !file.originalname) {
            return cb(new Error("Invalid file upload"));
        }

        const ext = path.extname(file.originalname);
        const baseName = path.basename(file.originalname, ext);
        const timestamp = Date.now();
        const newFileName = `${baseName}_${timestamp}${ext}`;

        cb(null, newFileName);
    }
});


// 🔄 Multer Middleware
const upload = multer({ storage });

// 📌 Upload File
app.post("/upload", upload.single("file"), (req, res) => {
    let { userId, category } = req.body;
    userId = userId || "defaultUser";
    category = category || "uncategorized";

    if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
    }

    // if (!userId || !category) {
    //     return res.status(400).json({ error: "Missing userId or category" });
    // }

    // ✅ Correct directory creation AFTER multer handles `req.body`
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
            path: newFilePath,
            uploadedAt: new Date()
        }
    });
});

// 📌 Retrieve Latest Version of a File
app.get("/files/latest", (req, res) => {
    const { userId, category, fileName } = req.query;

    if (!userId || !category || !fileName) {
        return res.status(400).json({ error: "Missing required query parameters" });
    }

    const dirPath = path.join(STORAGE_DIR, userId, category);
    if (!fs.existsSync(dirPath)) {
        return res.status(404).json({ error: "No files found" });
    }

    const matchingFiles = fs.readdirSync(dirPath)
        .filter(f => f.startsWith(fileName))
        .sort((a, b) => {
            const timeA = parseInt(a.split("_").pop().split(".")[0], 10);
            const timeB = parseInt(b.split("_").pop().split(".")[0], 10);
            return timeB - timeA;
        });

    if (matchingFiles.length === 0) {
        return res.status(404).json({ error: "File not found" });
    }

    res.json({
        latestFile: matchingFiles[0],
        path: path.join(dirPath, matchingFiles[0])
    });
});

// 📌 Retrieve Specific Version of a File
app.get("/files/version", (req, res) => {
    const { userId, category, fileName, timestamp } = req.query;

    if (!userId || !category || !fileName || !timestamp) {
        return res.status(400).json({ error: "Missing required query parameters" });
    }

    const dirPath = path.join(STORAGE_DIR, userId, category);
    const fullFileName = `${fileName}_${timestamp}${path.extname(fileName)}`;

    const filePath = path.join(dirPath, fullFileName);
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "File version not found" });
    }

    res.json({
        file: fullFileName,
        path: filePath
    });
});

// 📌 List All Files in a Category
app.get("/files/list", (req, res) => {
    const { userId, category } = req.query;

    if (!userId || !category) {
        return res.status(400).json({ error: "Missing required query parameters" });
    }

    const dirPath = path.join(STORAGE_DIR, userId, category);
    if (!fs.existsSync(dirPath)) {
        return res.status(404).json({ error: "No files found" });
    }

    const files = fs.readdirSync(dirPath);
    res.json({
        files
    });
});

// 🚀 Start Server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
