const { Client } = require("minio");

const minioClient = new Client({
	endPoint: "minio",
	port: 9000,
	useSSL: false,
	accessKey: "minio",
	secretKey: "minio123",
});

module.exports = minioClient;
