# LegalConnect

LegalConnect is a modern platform for hierarchical legal information access.

## 🚀 Quick Start

1.  **Start Infrastructure**:
    ```bash
    docker-compose up -d
    ```
    This starts MySQL, MongoDB, and the Nginx API Gateway.

2.  **Start Backend Services**:
    - **Node.js**: Navigate to `backend/node` and run `npm start`.
    - **.NET Core**: Navigate to `backend/dotnet/CoreApi` and run `dotnet run`.

3.  **Start Frontend**:
    - Navigate to `frontend` and run `npm start`.

## 🏗️ Architecture

The project follows a **Microservices Architecture**:
- **API Gateway**: Nginx (Port 8888)
- **Auth Service**: .NET Core + MySQL
- **Legal Service**: Node.js + MongoDB
- **Frontend**: Angular + Tailwind CSS

For a detailed explanation of the architecture and technology choices, see:
👉 **[PROJECT_ARCHITECTURE.md](./PROJECT_ARCHITECTURE.md)**

## 📂 Project Structure

- `frontend/`: Angular application.
- `backend/node/`: Node.js microservice for legal content.
- `backend/dotnet/`: .NET Core microservice for authentication.
- `nginx/`: API Gateway configuration.
- `docker-compose.yml`: Infrastructure orchestration.
