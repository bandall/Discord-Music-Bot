FROM node:18.4.0

LABEL maintainer="jsm5315@ajou.ac.kr"

WORKDIR /home/node/app

# 임시 라이브러리 폴더 생성 play-l 패치 다운로드 및 빌드
RUN mkdir /play-dl && cd /play-dl

RUN git clone https://github.com/YuzuZensai/play-dl-test.git

RUN cd play-dl && npm run build

RUN cd /home/node/app

# -----------------------------------------------------

COPY package*.json ./

RUN npm install

RUN npm install -g pm2 

# RUN npm install copyfiles -g

COPY ./ ./

RUN npm run build

WORKDIR /home/node/app/Discord-Music-Bot

# CMD ["node", "/home/node/app/build/app.js", "--name", "Music Bot"]

ENTRYPOINT ["pm2-runtime", "/home/node/app/build/app.js", "--name", "Music Bot"]