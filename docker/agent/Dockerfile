FROM python:3.11-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY hermes-agent /app

RUN pip install --no-cache-dir -e .

EXPOSE 8642

CMD ["hermes", "gateway", "run"]
