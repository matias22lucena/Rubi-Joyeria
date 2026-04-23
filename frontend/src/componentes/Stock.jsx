import { useState, useEffect } from "react";
import "../css/Stock.css";

const API_URL = import.meta.env.VITE_API_URL;

const Stock = () => {
  const [stock, setStock] = useState([]);

  useEffect(() => {
    obtenerStock();
  }, []);

  const obtenerStock = async () => {
    try {
      console.log("🔹 Solicitando datos del stock...");
      const response = await fetch(`${API_URL}/api/stock`);

      if (!response.ok) {
        throw new Error("Error al obtener stock");
      }

      const data = await response.json();
      console.log("✅ Datos recibidos del backend:", data);

      setStock(data);
    } catch (error) {
      console.error("❌ Error al cargar stock:", error);
    }
  };

  const getStockStatus = (cantidad) => {
    if (cantidad < 5) return "red";
    if (cantidad >= 5 && cantidad <= 10) return "yellow";
    return "green";
  };

  return (
    <div className="stock-container container mt-4">
      <h2 className="stock-title">Inventario de Stock</h2>
      <div className="table-container">
        <div className="table-responsive">
          <table className="table table-striped">
            <thead>
              <tr>
                <th>Código</th>
                <th>Detalles</th>
                <th>P. Venta</th>
                <th>Stock</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {stock.length > 0 ? (
                stock.map((s, index) => (
                  <tr key={index}>
                    <td>{index + 1}</td>
                    <td>{s.CodigoProducto}</td>
                    <td>{s.DetallesProducto || "Sin detalles"}</td>
                    <td>${Number(String(s.PrecioVenta).replace(/,/g, "")).toFixed(2)}</td>
                    <td>{s.Cantidad}</td>
                    <td>
                      <span
                        className="estado-circle"
                        style={{
                          backgroundColor: getStockStatus(s.Cantidad),
                          width: "20px",
                          height: "20px",
                          display: "inline-block",
                          borderRadius: "50%",
                        }}
                      ></span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5">No hay productos en stock.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Stock;