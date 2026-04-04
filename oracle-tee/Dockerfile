FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
ENV EXTENSION_PORT=8080
ENV ORACLE_PORT=8095
EXPOSE 8080 8095
CMD ["python", "main.py"]
