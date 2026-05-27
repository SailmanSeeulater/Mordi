import axios from "axios";

const client = axios.create({
  baseURL: "http://146.235.217.254:8080",
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default client;
