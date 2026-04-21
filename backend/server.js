import express from "express";
import bodyParser from "body-parser";
import mysql from "mysql2";
import cors from "cors";
import nodemailer from "nodemailer";
import multer from "multer";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  })
);

app.use(bodyParser.json());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

// Configuración de la conexión a la base de datos
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
});

db.connect((err) => {
  if (err) {
    console.error("Error al conectar a la base de datos:", err);
  } else {
    console.log("Conexión exitosa a la base de datos.");
  }
});

// Configuración de Nodemailer
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Ruta de prueba
app.get("/", (req, res) => {
  res.send("API funcionando correctamente");
});

// 🔹 Ruta para enviar factura PDF por Gmail
app.post("/api/enviar-factura", upload.single("factura"), async (req, res) => {
  const { email } = req.body;
  const archivoPDF = req.file;

  if (!archivoPDF || !email) {
    return res.status(400).json({ message: "Faltan datos para enviar la factura." });
  }

  try {
    await transporter.sendMail({
      from: `"Joyería RUBÍ" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Factura de compra - Joyería RUBÍ",
      text: "Adjuntamos su factura. ¡Gracias por su compra!",
      attachments: [
        {
          filename: archivoPDF.originalname,
          content: archivoPDF.buffer,
        },
      ],
    });

    res.json({ message: "Factura enviada correctamente." });
  } catch (error) {
    console.error("Error al enviar factura:", error);
    res.status(500).json({ message: "Error al enviar factura por Gmail." });
  }
});

// 🔹 Middleware para verificar si un usuario es administrador
const verificarAdmin = (req, res, next) => {
  let userRole = req.headers["user-role"] || req.get("user-role");

  console.log("Rol recibido en el backend:", userRole);

  if (!userRole) {
    return res.status(403).json({ message: "No se proporcionó un rol en la solicitud." });
  }

  userRole = userRole.toString().trim();

  if (userRole !== "1") {
    return res.status(403).json({
      message: `Acceso denegado. Se requiere rol de administrador. Recibido: ${userRole}`,
    });
  }

  next();
};

// 🔹 Ruta para obtener todos los usuarios
app.get("/api/usuarios", (req, res) => {
  const query = "SELECT IDUsuario, Nombre, Correo, IDRol FROM Usuarios";
  db.query(query, (err, results) => {
    if (err) {
      console.error("Error al obtener usuarios:", err);
      return res.status(500).json({ message: "Error del servidor." });
    }
    res.json(results);
  });
});

// 🔹 Ruta para editar usuario
app.put("/api/usuarios/:id", verificarAdmin, (req, res) => {
  const { id } = req.params;
  let { Nombre, Correo, Contraseña, IDRol } = req.body;

  if (!Nombre || !Correo) {
    return res.status(400).json({ message: "El nombre y el correo son obligatorios." });
  }

  IDRol = parseInt(IDRol, 10);
  if (isNaN(IDRol)) {
    return res.status(400).json({ message: "El rol debe ser un número válido." });
  }

  let query;
  let values;

  if (Contraseña && Contraseña.trim() !== "") {
    query =
      "UPDATE Usuarios SET Nombre = ?, Correo = ?, Contrasena = ?, IDRol = ? WHERE IDUsuario = ?";
    values = [Nombre, Correo, Contraseña, IDRol, id];
  } else {
    query = "UPDATE Usuarios SET Nombre = ?, Correo = ?, IDRol = ? WHERE IDUsuario = ?";
    values = [Nombre, Correo, IDRol, id];
  }

  db.query(query, values, (err, result) => {
    if (err) {
      console.error("❌ Error al actualizar usuario:", err);
      return res.status(500).json({ message: "Error del servidor." });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Usuario no encontrado." });
    }
    res.json({ message: "Usuario actualizado correctamente." });
  });
});

// 🔹 Ruta para eliminar un usuario
app.delete("/api/usuarios/:id", verificarAdmin, (req, res) => {
  const { id } = req.params;
  const userId = req.headers["user-id"];

  if (userId && parseInt(userId) === parseInt(id)) {
    return res.status(403).json({ message: "No puedes eliminar tu propio usuario." });
  }

  const query = "DELETE FROM Usuarios WHERE IDUsuario = ?";
  db.query(query, [id], (err, result) => {
    if (err) {
      console.error("❌ Error al eliminar usuario:", err);
      return res.status(500).json({ message: "Error al eliminar usuario.", error: err.sqlMessage || err });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Usuario no encontrado." });
    }

    res.json({ message: "✅ Usuario eliminado correctamente." });
  });
});

// 🔹 Ruta para login
app.post("/api/login", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Por favor, complete todos los campos." });
  }

  const query = "SELECT IDUsuario, Nombre, IDRol FROM Usuarios WHERE Correo = ? AND Contrasena = ?";
  db.query(query, [email, password], (err, results) => {
    if (err) {
      console.error("Error al consultar la base de datos:", err);
      return res.status(500).json({ message: "Error del servidor." });
    }

    if (results.length > 0) {
      const { IDUsuario, Nombre, IDRol } = results[0];
      res.json({
        message: "Inicio de sesión exitoso.",
        userId: IDUsuario,
        userName: Nombre,
        userRole: IDRol.toString(),
      });
    } else {
      res.status(401).json({ message: "Correo o contraseña incorrectos." });
    }
  });
});

// 🔹 Ruta para registrar usuarios
app.post("/api/register", (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({ message: "Por favor, complete todos los campos." });
  }

  const query = "INSERT INTO Usuarios (Nombre, Correo, Contrasena, IDRol) VALUES (?, ?, ?, ?)";
  db.query(query, [name, email, password, role], (err) => {
    if (err) {
      console.error("Error al registrar al usuario:", err);
      return res.status(500).json({ message: "Error del servidor." });
    }
    res.json({ message: "Usuario registrado exitosamente." });
  });
});

// 🔹 Recuperación de contraseña
app.post("/api/forgot-password", (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ message: "Por favor, ingrese su correo." });
  }

  const code = Math.floor(100000 + Math.random() * 900000);
  const query = "UPDATE Usuarios SET CodigoRecuperacion = ? WHERE Correo = ?";

  db.query(query, [code, email], (err, results) => {
    if (err) {
      console.error("Error al generar el código:", err);
      return res.status(500).json({ message: "Error del servidor." });
    }

    if (results.affectedRows === 0) {
      return res.status(404).json({ message: "Correo no encontrado." });
    }

    const mailOptions = {
      from: `"Recuperación de Contraseña" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Código de Recuperación",
      text: `Tu código de recuperación es: ${code}`,
    };

    transporter.sendMail(mailOptions, (error) => {
      if (error) {
        console.error("Error al enviar el correo:", error);
        return res.status(500).json({ message: "Error al enviar el correo." });
      }
      res.json({ message: "Código enviado. Por favor, revise su correo." });
    });
  });
});

// 🔹 Ruta para obtener todos los proveedores
app.get("/api/proveedores", (req, res) => {
  const query = "SELECT * FROM Proveedores";
  db.query(query, (err, results) => {
    if (err) {
      console.error("Error al obtener proveedores:", err);
      return res.status(500).json({ message: "Error del servidor al obtener proveedores." });
    }
    res.json(results);
  });
});

// 🔹 Ruta para registrar un proveedor
app.post("/api/proveedores", (req, res) => {
  let { codigoProveedor, nombre, direccion, telefono, tipoProveedor, codigos } = req.body;

  if (!codigoProveedor || !nombre || !direccion || !telefono || !tipoProveedor || !codigos) {
    return res.status(400).json({
      message: "Todos los campos, incluido el Código de Proveedor, son obligatorios.",
    });
  }

  if (typeof codigos === "string") {
    codigos = [codigos];
  }

  if (!Array.isArray(codigos) || codigos.length === 0) {
    return res.status(400).json({ message: "El campo 'codigos' debe ser un array válido." });
  }

  const codigosProductos = codigos.join(",");

  const checkQuery = "SELECT COUNT(*) AS count FROM Proveedores WHERE CodigoProveedor = ?";
  db.query(checkQuery, [codigoProveedor], (err, result) => {
    if (err) {
      console.error("Error al verificar código de proveedor:", err);
      return res.status(500).json({ message: "Error del servidor al verificar código de proveedor." });
    }

    if (result[0].count > 0) {
      return res.status(400).json({ message: "El código de proveedor ya existe. Usa uno diferente." });
    }

    const insertQuery = `
      INSERT INTO Proveedores (CodigoProveedor, Nombre, Direccion, Telefono, TipoProveedor, CodigosProductos)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    db.query(
      insertQuery,
      [codigoProveedor, nombre, direccion, telefono, tipoProveedor, codigosProductos],
      (err, result) => {
        if (err) {
          console.error("Error al insertar proveedor:", err);
          return res.status(500).json({
            message: "Error del servidor al registrar proveedor.",
            error: err.sqlMessage || err,
          });
        }
        res.json({ message: "Proveedor registrado correctamente.", proveedorId: result.insertId });
      }
    );
  });
});

app.put("/api/proveedores/:id", (req, res) => {
  const { id } = req.params;
  let { codigoProveedor, nombre, direccion, telefono, tipoProveedor, codigos } = req.body;

  if (!codigoProveedor || !nombre || !direccion || !telefono || !tipoProveedor || !codigos) {
    return res.status(400).json({ message: "Todos los campos son obligatorios." });
  }

  if (typeof codigos === "string") {
    codigos = [codigos];
  }

  if (!Array.isArray(codigos) || codigos.length === 0) {
    return res.status(400).json({ message: "El campo 'codigos' debe ser un array válido." });
  }

  const codigosProductos = codigos.join(",");

  const query = `
    UPDATE Proveedores 
    SET CodigoProveedor = ?, Nombre = ?, Direccion = ?, Telefono = ?, TipoProveedor = ?, CodigosProductos = ?
    WHERE IDProveedor = ?
  `;

  db.query(
    query,
    [codigoProveedor, nombre, direccion, telefono, tipoProveedor, codigosProductos, id],
    (err, result) => {
      if (err) {
        console.error("❌ Error al actualizar proveedor:", err);
        return res.status(500).json({ message: "Error del servidor al actualizar proveedor." });
      }
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "Proveedor no encontrado." });
      }
      res.json({ message: "✅ Proveedor actualizado con éxito." });
    }
  );
});

app.delete("/api/proveedores/:id", (req, res) => {
  const { id } = req.params;

  const query = "DELETE FROM Proveedores WHERE IDProveedor = ?";
  db.query(query, [id], (err, result) => {
    if (err) {
      console.error("Error al eliminar proveedor:", err);
      return res.status(500).json({ message: "Error al eliminar proveedor.", error: err.sqlMessage || err });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Proveedor no encontrado." });
    }
    res.json({ message: "Proveedor eliminado correctamente." });
  });
});

// 🔹 Ruta para obtener compras
app.get("/api/compras", (req, res) => {
  const query = `
    SELECT c.IDCompra, c.Fecha, c.CodigoProveedor, p.Nombre AS NombreProveedor, 
           c.CodigoProducto, c.Cantidad, c.PrecioTotal, c.DetallesProducto
    FROM Compras c
    LEFT JOIN Proveedores p ON c.CodigoProveedor = p.CodigoProveedor
  `;

  db.query(query, (err, results) => {
    if (err) {
      console.error("ERROR AL OBTENER COMPRAS:", err.sqlMessage || err);
      return res.status(500).json({
        message: "Error al obtener compras.",
        error: err.sqlMessage || err.message,
      });
    }

    res.json(results);
  });
});

// 🔹 Registrar compra
app.post("/api/compras", (req, res) => {
  let { fecha, CodigoProveedor, CodigoProducto, cantidad, PrecioTotal, DetallesProducto } = req.body;

  if (!fecha || !CodigoProveedor || !CodigoProducto || !cantidad || !PrecioTotal) {
    return res.status(400).json({ message: "Todos los campos son obligatorios." });
  }

  cantidad = parseInt(cantidad);
  PrecioTotal = parseFloat(PrecioTotal);
  DetallesProducto = DetallesProducto ? DetallesProducto.trim() : "Sin detalles";

  if (isNaN(cantidad) || cantidad <= 0 || isNaN(PrecioTotal) || PrecioTotal <= 0) {
    return res.status(400).json({
      message: "Cantidad y PrecioTotal deben ser valores numéricos mayores a 0.",
    });
  }

  const query = `
    INSERT INTO Compras (Fecha, CodigoProveedor, CodigoProducto, Cantidad, PrecioTotal, DetallesProducto)
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  db.query(
    query,
    [fecha, CodigoProveedor, CodigoProducto, cantidad, PrecioTotal, DetallesProducto],
    (err, result) => {
      if (err) {
        console.error("❌ ERROR AL REGISTRAR COMPRA:", err.sqlMessage || err);
        return res.status(500).json({ message: "Error al registrar compra.", error: err.sqlMessage || err });
      }
      res.json({ message: "✅ Compra registrada con éxito.", idCompra: result.insertId });
    }
  );
});

// 🔹 Obtener stock
app.get("/api/stock", (req, res) => {
  const query = `
    SELECT 
      IDStock,
      CodigoProducto,
      Descripcion,
      Cantidad, 
      CAST(PrecioCompra AS DECIMAL(10,2)) AS PrecioCompra,
      CAST(PrecioVenta AS DECIMAL(10,2)) AS PrecioVenta,
      DetallesProducto
    FROM Stock
  `;

  db.query(query, (err, results) => {
    if (err) {
      console.error("❌ ERROR AL OBTENER STOCK:", err.sqlMessage || err);
      return res.status(500).json({ message: "Error al obtener stock.", error: err.sqlMessage || err });
    }

    res.json(results);
  });
});

// 🔹 Ajustar stock
app.put("/api/stock/:codigoProducto", (req, res) => {
  const { codigoProducto } = req.params;
  const { cantidad } = req.body;

  if (!cantidad || isNaN(cantidad) || cantidad < 0) {
    return res.status(400).json({ message: "Cantidad inválida." });
  }

  const query = "UPDATE Stock SET Cantidad = ? WHERE CodigoProducto = ?";
  db.query(query, [cantidad, codigoProducto], (err, result) => {
    if (err) {
      console.error("❌ ERROR AL ACTUALIZAR STOCK:", err.sqlMessage || err);
      return res.status(500).json({ message: "Error al actualizar stock.", error: err.sqlMessage || err });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Producto no encontrado en stock." });
    }
    res.json({ message: "✅ Stock actualizado correctamente." });
  });
});

// 🔹 Obtener ventas
app.get("/api/ventas", (req, res) => {
  const query = `
    SELECT v.IDVenta, v.Fecha, v.MetodoPago,
           d.CodigoProducto, s.Descripcion, d.Cantidad, d.Subtotal
    FROM Ventas v
    JOIN DetalleVenta d ON v.IDVenta = d.IDVenta
    JOIN Stock s ON d.CodigoProducto = s.CodigoProducto
    ORDER BY v.Fecha DESC, v.IDVenta DESC
  `;

  db.query(query, (err, results) => {
    if (err) {
      console.error("❌ ERROR AL OBTENER VENTAS:", err.sqlMessage || err);
      return res.status(500).json({ message: "Error al obtener ventas.", error: err.sqlMessage || err });
    }

    res.json(results);
  });
});

// 🔹 Registrar venta
app.post("/api/ventas", (req, res) => {
  const { fecha, metodoPago, detalles } = req.body;

  if (!fecha || !metodoPago || !detalles || detalles.length === 0) {
    return res.status(400).json({ message: "Todos los campos son obligatorios." });
  }

  const verificarStock = (callback) => {
    const errores = [];
    let pendientes = detalles.length;

    detalles.forEach((p) => {
      const query = "SELECT Cantidad FROM Stock WHERE CodigoProducto = ?";
      db.query(query, [p.CodigoProducto], (err, result) => {
        if (err) {
          errores.push(`Error al consultar stock de ${p.CodigoProducto}`);
        } else if (!result.length || result[0].Cantidad < p.Cantidad) {
          errores.push(
            `Stock insuficiente para ${p.CodigoProducto}. Disponible: ${result[0]?.Cantidad ?? 0}, solicitado: ${p.Cantidad}`
          );
        }

        pendientes--;
        if (pendientes === 0) callback(errores);
      });
    });
  };

  verificarStock((errores) => {
    if (errores.length > 0) {
      return res.status(400).json({ message: errores.join("\n") });
    }

    const queryVenta = "INSERT INTO Ventas (Fecha, MetodoPago) VALUES (?, ?)";
    db.query(queryVenta, [fecha, metodoPago], (err, result) => {
      if (err) {
        console.error("ERROR AL REGISTRAR VENTA:", err);
        return res.status(500).json({ message: "Error al registrar la venta." });
      }

      const idVenta = result.insertId;
      const queryDetalle =
        "INSERT INTO DetalleVenta (IDVenta, CodigoProducto, Cantidad, Subtotal) VALUES ?";
      const valores = detalles.map((p) => [idVenta, p.CodigoProducto, p.Cantidad, p.Subtotal]);

      db.query(queryDetalle, [valores], (err) => {
        if (err) {
          console.error("ERROR AL REGISTRAR DETALLE:", err);
          return res.status(500).json({ message: "Error al registrar detalle de venta." });
        }

        detalles.forEach((p) => {
          const queryStock = "UPDATE Stock SET Cantidad = Cantidad - ? WHERE CodigoProducto = ?";
          db.query(queryStock, [p.Cantidad, p.CodigoProducto], (err) => {
            if (err) console.error("ERROR AL ACTUALIZAR STOCK:", err);
          });
        });

        res.json({ message: "Venta registrada con éxito.", idVenta });
      });
    });
  });
});

// 🔹 Registrar cambio
app.post("/api/cambios", (req, res) => {
  const { fecha, productoDevuelto, productoNuevo } = req.body;

  if (
    !fecha ||
    !productoDevuelto?.CodigoProducto ||
    !productoDevuelto?.Cantidad ||
    !productoNuevo?.CodigoProducto ||
    !productoNuevo?.Cantidad
  ) {
    return res.status(400).json({ message: "Todos los campos son obligatorios." });
  }

  const queryDevolver = `
    UPDATE Stock 
    SET Cantidad = Cantidad + ? 
    WHERE CodigoProducto = ?
  `;

  const queryNuevo = `
    UPDATE Stock 
    SET Cantidad = Cantidad - ? 
    WHERE CodigoProducto = ?
  `;

  db.query(queryDevolver, [productoDevuelto.Cantidad, productoDevuelto.CodigoProducto], (err) => {
    if (err) {
      console.error("❌ Error al devolver producto:", err);
      return res.status(500).json({ message: "Error al devolver producto." });
    }

    db.query(queryNuevo, [productoNuevo.Cantidad, productoNuevo.CodigoProducto], (err) => {
      if (err) {
        console.error("❌ Error al descontar nuevo producto:", err);
        return res.status(500).json({ message: "Error al descontar nuevo producto." });
      }

      return res.json({ message: "✅ Cambio registrado correctamente." });
    });
  });
});

// 🔹 Reporte de ventas
app.get("/api/reportes/ventas", (req, res) => {
  const { fechaInicio, fechaFin } = req.query;

  if (!fechaInicio || !fechaFin) {
    return res.status(400).json({ message: "Debe proporcionar fechas de inicio y fin." });
  }

  const query = `
    SELECT v.Fecha, d.Subtotal
    FROM Ventas v
    JOIN DetalleVenta d ON v.IDVenta = d.IDVenta
    WHERE v.Fecha BETWEEN ? AND ?
    ORDER BY v.Fecha ASC
  `;

  db.query(query, [fechaInicio, fechaFin], (err, results) => {
    if (err) {
      console.error("❌ ERROR AL CONSULTAR REPORTE DE VENTAS:", err);
      return res.status(500).json({ message: "Error al obtener reporte de ventas.", error: err });
    }

    res.json(results);
  });
});

// 🔹 Obtener caja
app.get("/api/caja", (req, res) => {
  const query = "SELECT * FROM Caja ORDER BY Fecha DESC";
  db.query(query, (err, results) => {
    if (err) {
      console.error("❌ Error al obtener movimientos de caja:", err);
      return res.status(500).json({ message: "Error del servidor al obtener movimientos de caja." });
    }
    res.json(results);
  });
});

// 🔹 Registrar movimiento de caja
app.post("/api/caja", (req, res) => {
  const { tipo, monto, descripcion } = req.body;

  if (!tipo || !monto || isNaN(monto)) {
    return res.status(400).json({ message: "Datos incompletos o incorrectos." });
  }

  const query = "INSERT INTO Caja (TipoMovimiento, Monto, Descripcion) VALUES (?, ?, ?)";
  db.query(query, [tipo.toUpperCase(), parseFloat(monto), descripcion || null], (err) => {
    if (err) {
      console.error("❌ Error al registrar movimiento de caja:", err);
      return res.status(500).json({ message: "Error al registrar el movimiento." });
    }
    res.json({ message: "✅ Movimiento registrado correctamente." });
  });
});

// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});