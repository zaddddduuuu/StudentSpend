# 🚀 Deploying StudentSpend to Render & MongoDB Atlas

This complete guide will help you deploy StudentSpend with permanent cloud storage on **MongoDB Atlas** and host it for free on **Render**.

---

## Part 1: Set Up MongoDB Atlas (Free Cloud Database)

1. **Sign Up or Log In:**
   - Go to [mongodb.com](https://www.mongodb.com/) and create a free account.

2. **Create a Free Cluster:**
   - Click **Create a Deployment / Database**.
   - Choose the **M0 Free** shared tier.
   - Select your preferred cloud provider (AWS / Google Cloud) and the region closest to you or your Render service (e.g., Oregon, Frankfurt, Singapore, Mumbai).
   - Click **Create Deployment**.

3. **Create Database Credentials (Username & Password):**
   - In MongoDB Atlas, go to **Security** &rarr; **Database Access**.
   - Click **Add New Database User**.
   - Choose **Password** authentication.
   - Enter a username (e.g. `studentspend_admin`) and a secure password.
     > 💡 *Note: If your password contains special characters like `@`, `:`, `/`, or `#`, URL-encode them or use alphanumeric characters to avoid URI parsing issues.*
   - Set privileges to **Read and write to any database**.
   - Click **Add User**.

4. **Whitelist Network Access (Crucial for Render):**
   - Go to **Security** &rarr; **Network Access**.
   - Click **Add IP Address**.
   - Choose **Allow Access from Anywhere** (`0.0.0.0/0`).
     > ⚠️ *Render uses dynamic outgoing IP addresses for web services. Allowing `0.0.0.0/0` ensures your Render app can always connect to your database without connection timeouts.*
   - Click **Confirm**.

5. **Get Your Connection String (URI):**
   - Go to **Database** &rarr; Click **Connect** next to your cluster.
   - Choose **Drivers** (Node.js).
   - Copy the connection string format:
     ```text
     mongodb+srv://<username>:<password>@cluster0.abcde.mongodb.net/studentspend?retryWrites=true&w=majority
     ```
   - Replace `<username>` and `<password>` with your database user credentials.
   - Ensure the database name is `studentspend` (or whichever name you prefer).

---

## Part 2: Push Your Code to GitHub

If you haven't already pushed your code to GitHub:

```bash
git init
git add .
git commit -m "Configure StudentSpend for Render and MongoDB"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo-name>.git
git push -u origin main
```

---

## Part 3: Deploy on Render

1. **Sign Up or Log In to Render:**
   - Go to [render.com](https://render.com/) and sign in with your GitHub account.

2. **Create a New Web Service:**
   - In the Render Dashboard, click **New +** &rarr; **Web Service**.
   - Select **Build and deploy from a Git repository**.
   - Connect your GitHub repository.

3. **Configure Service Settings:**
   - **Name:** `studentspend` (or your chosen name)
   - **Region:** Choose the region closest to your MongoDB cluster (e.g., Oregon)
   - **Branch:** `main`
   - **Runtime:** `Node`
   - **Build Command:**
     ```bash
     npm install && npm run build
     ```
   - **Start Command:**
     ```bash
     npm start
     ```
   - **Plan:** Free

4. **Configure Environment Variables:**
   Under **Environment Variables**, add the following:

   | Key | Value | Description |
   | :--- | :--- | :--- |
   | `NODE_ENV` | `production` | Enables production mode and static asset serving |
   | `MONGODB_URI` | `mongodb+srv://<user>:<password>@cluster0.abcde.mongodb.net/studentspend?retryWrites=true&w=majority` | Your MongoDB Atlas connection URI |
   | `GEMINI_API_KEY` | *(Optional)* | Your Gemini API Key for AI smart coaching and auto-categorization |

   *(Note: Render automatically supplies `PORT=10000`, which our server auto-detects).*

5. **Deploy:**
   - Click **Create Web Service**.
   - Render will automatically clone your repository, run `npm install && npm run build`, and launch `npm start` (`node dist/server.js`).

---

## Part 4: Verify Your Deployment

1. Once the deployment finishes, open your Render app URL (e.g. `https://studentspend.onrender.com`).
2. Go to **⚙️ Settings** in StudentSpend.
3. Check the **🚀 Render & MongoDB Atlas Status** section:
   - You should see a green badge: `🟢 Connected to MongoDB (studentspend)`.
   - Click **Test / Reconnect** anytime to test the connection.
4. Try creating an account or adding a transaction — your data will now be securely saved directly into your MongoDB Atlas cloud database and will persist forever!
