# LegalConnect Google Cloud & Firebase Deployment Guide

This guide describes how to deploy the entire LegalConnect microservices application to **Google Cloud Run** and **Firebase Hosting** for free.

---

## Step 1: Set up Cloud Databases

### 1. MongoDB Atlas (for NoSQL Legal Data)
1. Sign up/Log in at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. Create a free **M0 Sandbox** cluster (Select AWS or Google Cloud, and choose the closest region).
3. Under **Database Access**, create a user (e.g., `legaluser`) and password.
4. Under **Network Access**, click **Add IP Address** and choose **Allow Access From Anywhere** (`0.0.0.0/0`) so Google Cloud can connect.
5. Go to **Database** -> click **Connect** -> choose **Drivers** and copy your Connection String:
   ```text
   mongodb+srv://legaluser:<password>@cluster0.xxxx.mongodb.net/legalconnect_db?retryWrites=true&w=majority
   ```

### 2. TiDB Cloud (for Relational Auth Data)
1. Sign up/Log in at [TiDB Cloud](https://pingcap.com/products/tidb-cloud).
2. Create a **Serverless** cluster (completely free, no card required).
3. Under the cluster page, click **Connect** -> choose **MySQL CLI** or **Standard Connection** to get your connection details.
4. Copy the connection string. For .NET Core EF Core, it will look like:
   ```text
   server=<HOST>;port=4000;database=legalconnect_db;user=<USER>;password=<PASSWORD>;sslmode=verify-full;
   ```

---

## Step 2: Deploy Backend Services to Google Cloud Run

We will compile and deploy your APIs straight to Google Cloud Run. Run these commands from your local computer's terminal:

1. **Open PowerShell/Terminal** in the project root:
   ```bash
   cd c:\Users\anand\.gemini\antigravity\scratch\LegalConnect
   ```

2. **Enable required Google APIs** (runs once per project):
   ```bash
   gcloud services enable run.googleapis.com artifactregistry.googleapis.com
   ```

3. **Deploy .NET Auth Service:**
   ```bash
   cd backend/dotnet
   gcloud run deploy legalconnect-auth --source . --region us-central1 --allow-unauthenticated --set-env-vars="ConnectionStrings__DefaultConnection=<YOUR_TIDB_CONNECTION_STRING>,JWT__Secret=<YOUR_JWT_SECRET>"
   ```
   *Replace `<YOUR_TIDB_CONNECTION_STRING>` and `<YOUR_JWT_SECRET>` with your TiDB MySQL string and a secure random password string.*

4. **Deploy Node.js Legal Service:**
   ```bash
   cd ../node
   gcloud run deploy legalconnect-legal --source . --region us-central1 --allow-unauthenticated --set-env-vars="MONGO_URI=<YOUR_MONGO_ATLAS_CONNECTION_STRING>"
   ```
   *Replace `<YOUR_MONGO_ATLAS_CONNECTION_STRING>` with your MongoDB Atlas string.*

---

## Step 3: Deploy Frontend to Firebase Hosting

We will serve your frontend Angular app using Firebase's ultra-fast CDN, routing all `/api` calls directly to your new Google Cloud Run services.

1. **Log in to Firebase CLI:**
   ```bash
   firebase login
   ```
   *(This will open a browser to log you in).*

2. **Initialize Firebase in the project root:**
   *Navigate back to the project root:*
   ```bash
   cd c:\Users\anand\.gemini\antigravity\scratch\LegalConnect
   ```
   *Run initialization:*
   ```bash
   firebase init hosting
   ```
   *   Select **Use an existing project** and choose `legalconnect-501109`.
   *   For public directory, type `frontend/dist/frontend/browser`.
   *   Configure as a single-page app (rewrite all URLs to /index.html)? **Yes**.
   *   Set up automatic builds and deploys with GitHub? **No** (unless you want GitHub actions).

3. **Build the Angular App:**
   ```bash
   cd frontend
   npm run build -- --configuration=production
   ```

4. **Deploy to Firebase:**
   *Navigate back to root:*
   ```bash
   cd ..
   firebase deploy --only hosting
   ```

Firebase will output your hosting URL (e.g. `https://legalconnect-501109.web.app`). Open it in your browser and your app is fully live!
