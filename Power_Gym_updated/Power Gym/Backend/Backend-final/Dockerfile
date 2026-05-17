FROM python:3.11-slim

# Install Microsoft ODBC Driver 18 for SQL Server
RUN apt-get update && apt-get install -y \
    curl \
    gnupg2 \
    apt-transport-https \
    unixodbc-dev \
    && curl -fsSL https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor -o /usr/share/keyrings/microsoft-prod.gpg \
    && echo "deb [arch=amd64 signed-by=/usr/share/keyrings/microsoft-prod.gpg] https://packages.microsoft.com/debian/12/prod bookworm main" > /etc/apt/sources.list.d/mssql-release.list \
    && apt-get update \
    && ACCEPT_EULA=Y apt-get install -y msodbcsql18 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Force fresh copy of app code — increment this to bust cache
ARG CACHEBUST=4
COPY . .

# Create uploads directories
RUN mkdir -p uploads/profiles uploads/avatars uploads/chat uploads/cv

# Copy and run start script
COPY start.sh /start.sh
RUN chmod +x /start.sh

CMD ["/start.sh"]
