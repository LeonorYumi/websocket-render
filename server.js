const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "public")));

const usuarios = new Map();

app.get("/health", (req, res) => {
  res.json({ ok: true, message: "Servidor funcionando" });
});

io.on("connection", (socket) => {
  console.log("Usuario conectado:", socket.id);

  // recibe el parámetro 'sala'
  socket.on("registrarUsuario", (data) => {
    const sala = data.sala || "general";
    
    const usuario = {
      id: socket.id,
      nombre: data.nombre || "Anónimo",
      sala: sala // Guardamos la sala en los metadatos del usuario
    };

    usuarios.set(socket.id, usuario);

    // Unimos el socket a la sala específica
    socket.join(sala);

    io.emit("usuariosActualizados", Array.from(usuarios.values()));
    
    // El mensaje del sistema se envía únicamente a los integrantes de esa sala
    io.to(sala).emit("mensajeSistema", `${usuario.nombre} se conectó a la sala [${sala}]`);
  });

  // envía el mensaje global únicamente a la sala actual del usuario
  socket.on("mensajeGlobal", (data) => {
    const usuario = usuarios.get(socket.id);
    if (usuario) {
      io.to(usuario.sala).emit("mensajeGlobal", {
        usuario: data.usuario,
        mensaje: data.mensaje,
        hora: new Date().toLocaleTimeString()
      });
    }
  });

  socket.on("mensajePrivado", (data) => {
    io.to(data.destinoId).emit("mensajePrivado", {
      usuario: data.usuario,
      mensaje: data.mensaje,
      hora: new Date().toLocaleTimeString()
    });
  });

  socket.on("disconnect", () => {
    const usuario = usuarios.get(socket.id);
    usuarios.delete(socket.id);

    io.emit("usuariosActualizados", Array.from(usuarios.values()));

    if (usuario) {
      io.to(usuario.sala).emit("mensajeSistema", `${usuario.nombre} se desconectó`);
    }

    console.log("Usuario desconectado:", socket.id);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
});