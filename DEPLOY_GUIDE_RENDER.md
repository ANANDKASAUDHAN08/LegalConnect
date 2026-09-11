# 🚀 LegalConnect 100% Free Production Deployment Guide (Render.com)

Deploy the entire LegalConnect microservices application to **Render.com** for **100% free**, with **zero credit card required** and **24/7 uptime**.

---

## 🏗 Architecture Summary

| Service | Component | Free Tier Plan | Notes |
| :--- | :--- | :--- | :--- |
| `legalconnect-frontend` | Angular 17 User SPA | **Static Site** (Free) | Global CDN, Free SSL, Never sleeps |
| `legalconnect-admin` | Angular 17 Admin SPA | **Static Site** (Free) | Global CDN, Free SSL, Never sleeps |
| `legalconnect-legal` | Node.js / Express API | **Web Service** (Free) | REST API, MongoDB connected |
| `legalconnect-auth` | .NET 8 Web API | **Docker Web Service** (Free) | Auth, SignalR, TiDB MySQL connected |
| **Databases** | MongoDB Atlas & TiDB | **Free Cloud Sandboxes** | 100% Free forever, no credit card |

---

## Step 1: Set Up Free Cloud Databases (Takes 3 mins)

### 1. Free MongoDB Atlas (for Laws, Lawyers, FAQs)
1. Register/Log in at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) (No credit card needed).
2. Create a free **M0 Sandbox** cluster (Select AWS or Google Cloud, closest region to your users).
3. Under **Database Access**, create a user (e.g. `legaluser`) with a secure password.
4. Under **Network Access**, click **Add IP Address** -> Select **Allow Access From Anywhere** (`0.0.0.0/0`).
5. Click **Connect** -> **Drivers** -> Copy your connection URI:
   ```text
   mongodb+srv://legaluser:<password>@cluster0.xxxx.mongodb.net/legalconnect_db?retryWrites=true&w=majority
   ```

### 2. Free TiDB Cloud (for Relational Auth & User Data)
1. Register/Log in at [TiDB Cloud](https://pingcap.com/products/tidb-cloud) (No credit card needed).
2. Create a free **Serverless** cluster (5 GB free forever).
3. Click **Connect** -> Choose **MySQL CLI** / **Standard Connection** to get your host, user, and password.
4. Construct your MySQL connection string:
   ```text
   server=<YOUR_TIDB_HOST>;port=4000;database=legalconnect_db;user=<YOUR_TIDB_USER>;password=<YOUR_PASSWORD>;sslmode=verify-full;
   ```

---

## Step 2: Push Your Code to GitHub

Make sure your latest code including `render.yaml` is pushed to your GitHub repository:
```bash
git add .
git commit -m "feat(deploy): add render blueprint and 24/7 keep-alive for free production hosting"
git push origin main
```

---

## Step 3: Deploy All 4 Services with 1 Click on Render

1. Go to [Render.com](https://render.com) and sign up/sign in (Choose **Sign in with GitHub** — **no credit card is required**).
2. On your Render dashboard, click **"New +"** in the top-right corner.
3. Select **"Blueprint"** (Infrastructure as Code).
4. Connect your `LegalConnect` GitHub repository.
5. Render will automatically scan and detect the `render.yaml` file in your repository!
6. You will see all 4 services listed:
   * `legalconnect-legal` (Node.js API)
   * `legalconnect-auth` (.NET 8 Docker API)
   * `legalconnect-frontend` (Static Site)
   * `legalconnect-admin` (Static Site)

7. Fill in the two database variables prompted by Render:
   * `MONGO_URI`: Paste your MongoDB Atlas connection string from Step 1.
   * `ConnectionStrings__DefaultConnection`: Paste your TiDB connection string from Step 1.
8. Click **"Apply"**!

Render will build and deploy all 4 services in parallel. Within 3–5 minutes, all services will be live with free HTTPS URLs!

---

## Step 4: 24/7 Keep-Alive Setup (Never Sleep / Never Deactivate)

Render free web services automatically spin down if they receive no HTTP traffic for 15 minutes. To ensure your backends **never sleep** and respond instantly:

### Method A: Automated GitHub Actions Heartbeat (Already Configured!)
A GitHub Actions workflow (`.github/workflows/render-keep-alive.yml`) is included in your repository. It runs on a scheduled cron every 10 minutes to ping your health endpoints:
* `https://legalconnect-legal.onrender.com/api/health`
* `https://legalconnect-auth.onrender.com/api/health`

Because the ping occurs every 10 minutes, the 15-minute inactivity counter never expires.

### Method B: External Free Pinger (Optional Backup via UptimeRobot)
For 100% guarantee even if GitHub Actions delays cron jobs:
1. Sign up for free at [UptimeRobot.com](https://uptimerobot.com) (No credit card needed).
2. Click **Add New Monitor**:
   * Monitor Type: `HTTP(s)`
   * Friendly Name: `LegalConnect Node API`
   * URL: `https://legalconnect-legal.onrender.com/api/health`
   * Monitoring Interval: `5 minutes`
3. Add a second monitor for `.NET API`:
   * URL: `https://legalconnect-auth.onrender.com/api/health`
   * Monitoring Interval: `5 minutes`

Your backends will run **24/7/365 without sleeping**, completely free!

---

## Step 5: (Optional) Custom Domains

Render supports free custom domains with automatic Let's Encrypt SSL:
1. In the Render Dashboard, click your static site or web service.
2. Go to **Settings** -> **Custom Domains**.
3. Add your custom domain (e.g., `app.legalconnect.in` or `api.legalconnect.in`).
4. Add the CNAME record in your DNS provider (Cloudflare, GoDaddy, Namecheap, etc.).
