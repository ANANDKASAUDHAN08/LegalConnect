# LegalConnect Docker Setup Guide

This guide explains how to set up and run the local databases (MySQL and MongoDB) for the LegalConnect platform using Docker.

## 1. Prerequisites (What you need to install)

To run the databases locally without cluttering your system, you need to install Docker Desktop.

1. **Download Docker Desktop:** Go to [Docker's official website](https://www.docker.com/products/docker-desktop/) and download the Windows installer.
2. **Install Docker Desktop:** Run the installer. Ensure that the **WSL 2 backend** option is checked during installation (this makes Docker run much faster on Windows).
3. **Start Docker:** After installation, launch the Docker Desktop application. You should see a whale icon in your system tray indicating that the Docker engine is running.

## 2. Starting the Databases

We have provided a `docker-compose.yml` file in the root of the `LegalConnect` project. This file contains all the instructions Docker needs to download and start both MySQL and MongoDB with the correct settings.

1. Open a terminal (like PowerShell or Command Prompt).
2. Navigate to your project folder: `cd c:\Users\anand\.gemini\antigravity\scratch\LegalConnect`
3. Run the following command:
   ```bash
   docker-compose up -d
   ```
   *Note: The `-d` flag means "detached mode", so the databases will run in the background, and you can continue using the terminal.*

Docker will now download the MySQL and MongoDB images and start them. This might take a few minutes the very first time.

## 3. How to Connect to the Databases

Once the containers are running, you can connect to them using your favorite database tools, just as if they were installed directly on your PC!

### Connecting to MySQL (using MySQL Workbench)

1. Open **MySQL Workbench**.
2. Click the **+** icon next to "MySQL Connections" to add a new connection.
3. Fill in the details:
   - **Connection Name:** LegalConnect Local MySQL
   - **Hostname:** `localhost` (or `127.0.0.1`)
   - **Port:** `3306`
   - **Username:** `root`
4. Click **Store in Vault ...** and enter the password: `rootpassword`
5. Click **Test Connection**. It should say "Successfully made the MySQL connection".
6. Click **OK** to save. You can now use Workbench to view the `legalconnect_db`.

### Connecting to MongoDB (using MongoDB Compass)

1. Download and install [MongoDB Compass](https://www.mongodb.com/products/tools/compass) (the official GUI for MongoDB).
2. Open MongoDB Compass.
3. In the URI connection string box, paste the following:
   ```text
   mongodb://root:rootpassword@localhost:27017/
   ```
4. Click **Connect**. You should now be connected to the local MongoDB instance.

## 4. Useful Docker Commands

- **To stop the databases:** 
  ```bash
  docker-compose down
  ```
  *(This stops the containers, but your data is safely saved in Docker volumes).*

- **To view logs (if something isn't working):**
  ```bash
  docker-compose logs
  ```

- **To completely wipe the database data and start fresh:**
  ```bash
  docker-compose down -v
  ```
  *(Warning: The `-v` flag deletes the volumes, erasing all your local data!).*
