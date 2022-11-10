import {
  Button,
  Stack,
  Grid,
  Card,
  CardContent,
  TextField,
  Modal,
  Box,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import Swal from "sweetalert2";
import React, { useState } from "react";
import "./Home.scss";
import HelpOutlineRoundedIcon from "@mui/icons-material/HelpOutlineRounded";
import PersonOutlineTwoToneIcon from "@mui/icons-material/PersonOutlineTwoTone";

const baseUrl = process.env.REACT_APP_4_IN_ROW_BASE_URL;

const URL_HOME = `${baseUrl}/ws_home`;
const URL_PUBLIC = `${baseUrl}/ws_search_public`;
const URL_PRIVATE = `${baseUrl}/ws_search_private`;
const ws_home = new WebSocket(URL_HOME);

export default function Home() {
  // eslint-disable-next-line no-unused-vars
  const [nick, setNick] = useState("");
  const [users, setUsers] = useState("cargando...");

  ws_home.onopen = () => {
    ws_home.send("NEW USER IN HOME");

    ws_home.onmessage = (e) => {
      setUsers(e.data);
    };

    ws_home.onclose = (e) => {};
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps

  const handleChangeNick = (e) => {
    if (!(e.target.value.includes("/") || e.target.value.includes("\\"))) {
      setNick(e.target.value);
    }
  };

  return (
    <Stack mt={8} mb={-12.5}>
      <div className="tarjetas">
        <Grid container spacing={4} justifyContent="center">
          <Grid item xs={5} style={{ textAlign: "center" }}>
            <Card style={{ background: "#ffffff9e" }} sx={{ minWidth: 300 }}>
              <CardContent>
                <h1>4 EN LÍNEA</h1>
                <Stack direction="row" justifyContent="center" mt={8}>
                  <TextField
                    style={{ background: "white" }}
                    label="Nick"
                    onChange={handleChangeNick}
                    value={nick}
                  />
                </Stack>

                <Stack direction="row" justifyContent="center" mt={4}>
                  <Button
                    variant="contained"
                    type="submit"
                    style={{ background: "#053742" }}
                    onClick={() => PreFunctionCall(nick, FindPublicMatch)}
                  >
                    Partida Pública
                  </Button>
                </Stack>
                <Stack direction="row" justifyContent="center" mt={4}>
                  <Button
                    variant="contained"
                    type="submit"
                    style={{ background: "#053742" }}
                    onClick={() => PreFunctionCall(nick, CreatePrivateMatch)}
                  >
                    Crear Partida Privada
                  </Button>
                </Stack>
                <Stack direction="row" justifyContent="center" mb={8} mt={4}>
                  <Button
                    variant="contained"
                    type="submit"
                    style={{ background: "#053742" }}
                    onClick={() => PreFunctionCall(nick, FindPrivateMatch)}
                  >
                    Buscar Partida Privada
                  </Button>
                </Stack>
                {Instrucciones()}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </div>
      <div>
        <Stack direction="row" mr={3} ml={70} mt={-65} justifyContent="right">
          <Grid style={{ textAlign: "center" }}>
            <Grid justifyContent="center">
              <Card style={{ background: "#ffffff9e" }} sx={{ minWidth: 1 }}>
                <CardContent>
                  <h5>Jugadores Disponibles</h5>
                  <PersonOutlineTwoToneIcon />
                  {users}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Stack>
      </div>
    </Stack>
  );
}

function PreFunctionCall(nickSelected, functionCall) {
  if (nickSelected.length >= 3 && nickSelected.length <= 15) {
    functionCall(nickSelected);
  } else {
    Swal.fire({
      title: `Por favor, ingrese un nick de 3 a 15 caracteres`,
      heightAuto: false,
      allowOutsideClick: false,
      showCancelButton: false,
      showConfirmButton: true,
      icon: "error",
      confirmButtonText: "OK",
      cancelButtonColor: "green",
      backdrop: `
          rgba(0, 0, 0, 0.8)
          left top
          no-repeat
        `,
    });
  }
}

function FindPublicMatch(nickSelected) {
  const ws_search = new WebSocket(URL_PUBLIC);

  ws_search.onopen = () => {
    ws_search.send("NEW PLAYER IN SEARCH");

    ws_search.onmessage = (e) => {
      window.location = `/game/${e.data}/${nickSelected}`;
    };

    ws_search.onclose = (e) => {};
  };

  return Swal.fire({
    title: "Buscando oponente...",
    heightAuto: false,
    allowOutsideClick: false,
    cancelButtonText: "Cancelar",
    cancelButtonColor: "red",
    showCancelButton: true,
    showConfirmButton: false,
    backdrop: `
    rgba(0, 0, 0, 0.8)
    left top
    no-repeat
  `,
  }).then((result) => {
    if (!result.isConfirmed) {
      ws_search.close();
    }
  });
}

function CreatePrivateMatch(nickSelected) {
  const numberMatch = Math.floor(Math.random() * (99999 - 10000 + 1) + 10000);

  const ws_search = new WebSocket(URL_PRIVATE);

  ws_search.onopen = () => {
    ws_search.send(`${numberMatch};CREATE`);

    ws_search.onmessage = (e) => {
      window.location = `/game/${e.data}/${nickSelected}`;
    };

    ws_search.onclose = (e) => {};
  };

  return Swal.fire({
    title: `Su codigo de partida es ${numberMatch} esperando oponente...`,
    heightAuto: false,
    allowOutsideClick: false,
    showCancelButton: true,
    showConfirmButton: false,
    cancelButtonText: "Cancelar",
    cancelButtonColor: "red",
    backdrop: `
    rgba(0, 0, 0, 0.8)
    left top
    no-repeat
  `,
  }).then((result) => {
    if (!result.isConfirmed) {
      ws_search.close();
    }
  });
}

function FindPrivateMatch(nickSelected) {
  const ws_search = new WebSocket(URL_PRIVATE);

  ws_search.onopen = () => {
    ws_search.onmessage = (e) => {
      if (e.data === "THE GAME WAS NOT FOUND") {
        Swal.fire({
          title: `No se encontro una partida con este codigo`,
          heightAuto: false,
          allowOutsideClick: false,
          showCancelButton: false,
          showConfirmButton: true,
          icon: "error",
          confirmButtonText: "OK",
          cancelButtonColor: "green",
          backdrop: `
          rgba(0, 0, 0, 0.8)
          left top
          no-repeat
        `,
        }).then((result) => {
          if (result.isConfirmed) {
            ws_search.close();
          }
        });
      } else {
        window.location = `/game/${e.data}/${nickSelected}`;
      }
    };

    ws_search.onclose = (e) => {};
  };

  return Swal.fire({
    title: "Ingrese codigo de partida",
    heightAuto: false,
    allowOutsideClick: false,
    input: "text",
    showCancelButton: true,
    showCloseButton: true,
    confirmButtonText: "Aceptar",
    cancelButtonText: "Cancelar",
    confirmButtonColor: "green",
    cancelButtonColor: "red",
    backdrop: `
    rgba(0, 0, 0, 0.8)
    left top
    no-repeat
  `,
  }).then((result) => {
    if (!result.isConfirmed) {
      ws_search.close();
    } else {
      if (verifyInputCode(result.value)) {
        ws_search.send(`${result.value};FIND`);
      } else {
        Swal.fire({
          title: `Codigo Invalido`,
          heightAuto: false,
          allowOutsideClick: false,
          showCancelButton: false,
          showConfirmButton: true,
          icon: "error",
          confirmButtonText: "OK",
          cancelButtonColor: "green",
          backdrop: `
          rgba(0, 0, 0, 0.8)
          left top
          no-repeat
        `,
        }).then((result) => {
          if (result.isConfirmed) {
            ws_search.close();
          }
        });
      }
    }
  });
}

function verifyInputCode(code) {
  return code.length === 5 && Object.assign([], code).every(isNumber);
}

function isNumber(value) {
  const numbers = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
  return numbers.includes(value);
}

const stylebox = {
  position: "relative",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  height: "81%",
  width: 750,
  overflow: "auto",
  bgcolor: "#D7BDE2",
  border: "2px solid #000",
  borderRadius: "1%",
  boxShadow: 10,
  p: 4,
};

function Instrucciones() {
  const [open, setOpen] = React.useState(false);
  const handleOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);
  return (
    <div>
      <Box textAlign="center">
        <Stack direction="row" justifyContent="center" mb={2}>
          <Button
            onClick={handleOpen}
            variant="contained"
            style={{ background: "#053742" }}
          >
            Cómo se juega
            <HelpOutlineRoundedIcon />
          </Button>
        </Stack>
      </Box>

      <Modal
        open={open}
        onClose={handleClose}
        aria-labelledby="modal-modal-title"
        aria-describedby="modal-modal-description"
      >
        <Box sx={stylebox}>
          <Stack direction="row" justifyContent="right" mr={-1} mb={1}>
            <Button onClick={handleClose}>
              <CloseIcon color="error" />
            </Button>
          </Stack>
          <Stack textAlign={"center"}>
            <h2 className="Instrucciones">Objetivo:</h2>
            <p>
              <b>
                Ser el primer jugador en conectar 4 fichas del mismo color en
                una linea, ya sea en vertical, horizontal o diagonal.
              </b>
            </p>
            <h2 className="Instrucciones">Instrucciones:</h2>
            <p>
              <b>
                Los jugadores deben poner una ficha por turno haciendo click en
                la columna que desee. Se decide al azár quien comienza.
              </b>
            </p>
            <p>
              <b>
                Cada turno tiene un tiempo de 45 segundos, si éste se termina
                gana la ronda el oponente.
              </b>
            </p>
            <p>
              <b>
                Si las fichas se terminan y no hubo un ganador, hay empate y se
                comienza otra ronda.
              </b>
            </p>

            <h2 className="Instrucciones">Puntaje:</h2>
            <p>
              <b>Se necesita ganar 3 rondas para ganar la partida.</b>
            </p>
            <p>
              <b>Se puede pedir la revancha ;)</b>
            </p>
          </Stack>
        </Box>
      </Modal>
    </div>
  );
}
