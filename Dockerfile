# --- STAGE 1: Build ---
FROM node:24-alpine AS builder

WORKDIR /app

# Sao chép file định nghĩa package
COPY package*.json ./

# Cài đặt toàn bộ dependencies (bao gồm devDependencies để build)
RUN npm install

# Sao chép toàn bộ mã nguồn
COPY . .

# Build dự án NestJS sang thư mục /dist
RUN npm run build

# --- STAGE 2: Production ---
FROM node:24-alpine

WORKDIR /app

# Chỉ sao chép các file cần thiết từ builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist

# Chỉ cài đặt dependencies cho production (nhẹ hơn)
RUN npm install --omit=dev

# Mở cổng 3000
EXPOSE 3000

# Lệnh chạy ứng dụng
CMD ["npm", "run", "start:prod"]
