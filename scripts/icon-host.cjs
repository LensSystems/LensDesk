// Arranque mínimo de Electron para dibujar los iconos: sin ventanas propias.
const { app } = require("electron");

app.on("window-all-closed", () => {});
