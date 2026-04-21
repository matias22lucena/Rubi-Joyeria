import { useNavigate } from "react-router-dom";
import React, { useState } from "react";
import "../css/Login.css";
import logo from "../assets/logo_rubi.png";
import Swal from "sweetalert2";

const API_URL = import.meta.env.VITE_API_URL;

const Login = ({ setUserRole }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        Swal.fire({
          icon: "success",
          title: "¡Bienvenido!",
          text: data.message,
          confirmButtonColor: "#8B1123",
          timer: 2000,
          showConfirmButton: false,
        });

        localStorage.setItem("userRole", data.userRole.toString());
        localStorage.setItem("userId", data.userId);
        localStorage.setItem("userName", data.userName);

        setUserRole(data.userRole);
        navigate("/home");
      } else {
        Swal.fire({
          icon: "error",
          title: "Error al iniciar sesión",
          text: data.message,
          confirmButtonColor: "#8B1123",
        });
      }
    } catch (error) {
      console.error("Error al iniciar sesión:", error);
      Swal.fire({
        icon: "error",
        title: "Error del servidor",
        text: "No se pudo conectar con el servidor.",
        confirmButtonColor: "#8B1123",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <form onSubmit={handleSubmit} className="login-form">
        <div className="avatar">
          <img src={logo} alt="Logo Rubí" className="logo" />
        </div>
        <h2 className="login-titulo">Iniciar Sesión</h2>

        <input
          type="email"
          placeholder="Correo"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button type="submit" className="login-button" disabled={loading}>
          {loading ? "Cargando..." : "Iniciar Sesión"}
        </button>
      </form>
    </div>
  );
};

export default Login;