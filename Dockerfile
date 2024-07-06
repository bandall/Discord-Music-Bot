# 빌드 스테이지
FROM node:18.4.0-alpine AS builder

LABEL maintainer="jsm5315@ajou.ac.kr"

WORKDIR /home/node/app

# 임시 라이브러리 폴더 생성 및 빌드
RUN apk add --no-cache git
RUN git clone https://github.com/YuzuZensai/play-dl-test.git
WORKDIR /home/node/app/play-dl-test
RUN npm install && npm run build

# 애플리케이션 코드 복사 및 설치
WORKDIR /home/node/app
COPY ./ ./
RUN npm install
RUN npm install copyfiles -g
RUN npm install ./play-dl-test
RUN npm run build

# 최종 스테이지
FROM node:18.4.0-alpine

WORKDIR /home/node/app

# 빌드된 파일만 복사
COPY --from=builder /home/node/app /home/node/app
COPY --from=builder /home/node/app/play-dl-test /home/node/app/play-dl-test

RUN npm install -g pm2

WORKDIR /home/node/app/Discord-Music-Bot

ENTRYPOINT ["pm2-runtime", "/home/node/app/build/app.js", "--name", "Music Bot"]
