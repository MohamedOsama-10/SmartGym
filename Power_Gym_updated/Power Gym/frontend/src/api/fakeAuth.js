// src/api/fakeAuth.js
export const fakeApi = {
  register: async (data) => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (data.email === "test@gym.com") {
          reject({ message: "Email already exists" });
        } else {
          resolve({ message: "User registered successfully", user: data });
        }
      }, 1000);
    });
  },

  login: async (data) => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (data.email === "test@gym.com" && data.password === "123456") {
          resolve({ message: "Login successful", token: "fake-jwt-token" });
        } else {
          reject({ message: "Invalid email or password" });
        }
      }, 1000);
    });
  },
};
