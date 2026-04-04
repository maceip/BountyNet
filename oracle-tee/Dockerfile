FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
# Compute source hash at build time — deterministic from source files
RUN python3 -c "import hashlib,glob;h=hashlib.sha256();[h.update(open(f,'rb').read()) for f in sorted(glob.glob('**/*.py',recursive=True))];open('.source_hash','w').write(h.hexdigest())"
ENV EXTENSION_PORT=8080
ENV ORACLE_PORT=8095
EXPOSE 8080 8095
CMD ["python", "main.py"]
