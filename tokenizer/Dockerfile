FROM python:3.12-slim

# KoNLPy's Okt analyzer runs on the JVM.
RUN apt-get update \
    && apt-get install -y --no-install-recommends default-jre-headless g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /srv
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

# Warm the analyzers so the first request isn't slow.
RUN python -c "from app.main import tokenize_japanese, tokenize_chinese, tokenize_korean; \
tokenize_japanese('テスト'); tokenize_chinese('测试'); tokenize_korean('테스트')"

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
