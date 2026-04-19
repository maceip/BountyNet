FROM python:3.12-slim

WORKDIR /app

COPY tiny-model/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt

COPY tiny_openai_server.py /app/tiny_openai_server.py

CMD ["python", "/app/tiny_openai_server.py", "--host", "0.0.0.0", "--port", "8000", "--model-id", "sshleifer/tiny-gpt2", "--served-model-name", "base-coder"]
