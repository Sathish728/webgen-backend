import express from 'express'
import { connectDB } from './lib/db.js'
import dotenv from 'dotenv'
import cors from 'cors'
import authRoutes from './routes/auth.Routes.js'
import cookieParser from "cookie-parser";
import helmet from "helmet"
import templatesRouter from "./routes/Template.route.js"
import websiteRouter from "./routes/website.Routes.js"
import subscriptionRouter  from "./routes/subscription.Routes.js"
import webhookRouter   from "./routes/webhook.Routes.js"
import compression from 'compression'
import path from "path";
import { fileURLToPath } from "url";
import mongoose from 'mongoose'


// Define __filename and __dirname manually (for ES modules)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const app = express()
dotenv.config()

const PORT = process.env.PORT || 4000

// SECURITY MIDDLEWARE
// =================================================================

// Helmet for security headers
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for now (configure later)
  crossOriginEmbedderPolicy: false,
}));

const allowedOrigins = [
  "http://13.126.233.149:3000",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://webgen.club",
  "http://www.webgen.club",
  "https://webgen.club",
  "https://www.webgen.club"
];

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`❌ Blocked by CORS: ${origin}`);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Handle preflight requests
app.options("*", cors());

// BODY PARSERS & OTHER MIDDLEWARE
// =================================================================

app.use(cookieParser());
app.use("/api/templates", webhookRouter);

app.use(express.json({ limit: '10mb' })); // Limit payload size
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(compression()); // Compress responses

// Static files
app.use("/templates", express.static(path.join(__dirname, "templates")));


app.use("/api/auth", authRoutes)
app.use("/api/templates", templatesRouter);
app.use("/api/templates", subscriptionRouter);
app.use("/api/websites", websiteRouter);



// HEALTH CHECK ENDPOINT
// =================================================================

app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});


// 404 HANDLER
// =================================================================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.path} not found`,
    availableRoutes: [
      'GET  /health - Health check',
      'GET  /api/auth/* - Authentication routes',
      'GET  /api/templates/* - Template routes',
      'POST /api/templates/webhook - Stripe webhook',
    ]
  });
});


// ERROR HANDLER
// =================================================================

app.use((err, req, res, next) => {
  console.error("❌ Error:", err);

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: Object.values(err.errors).map(e => e.message)
    });
  }

  // Mongoose cast error (invalid ObjectId)
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: 'Invalid ID format'
    });
  }

  // CORS error
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({
      success: false,
      message: 'CORS policy: Origin not allowed'
    });
  }

  // Default error
  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});


app.listen(PORT, ()=> {console.log("Server is connected on PORT " + PORT)})
connectDB()