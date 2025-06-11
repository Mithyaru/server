const express = require("express");
const app = express();
const mysql = require("mysql2");
const cors = require("cors");
const nodemailer = require("nodemailer");

const db = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "Bolodecenoura0!",  //MUDAR ANTES DE ENVIAR
  database: "projetointegrado"   //MUDAR PARA SUAS INFORMACOES
});

app.use(cors());
app.use(express.json());


const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'email que usa pra enivar',    //MUDAR PARA SUAS INFORMACOES
    pass: 'senha do email' //MUDAR PARA SUAS INFORMACOES
  }
});

app.post('/login', (req, res) => {
  const { email, senha } = req.body;
  console.log('Recebendo login:', email, senha);
  if (!email || !senha) {
    return res.status(400).json({ error: 'Email e senha são obrigatórios.' });
  }
  const query = 'SELECT nome, email, apartamento, adm FROM usuario WHERE email = ? AND senha = ?';
  db.query(query, [email, senha], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Erro no servidor.' });
    }
    if (results.length === 0) {
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    console.log('Resultado do banco:', results[0])
    const user = results[0];

    return res.status(200).json({
      message: 'Login successful', adm: Boolean(user.adm), nome: user.nome, email: user.email,
      apartamento: user.apartamento
    });
  });
});

app.post("/registerMorador", (req, res) => {
  const { nome, telefone, apartamento, email, senha } = req.body;
  console.log(nome, telefone, apartamento, email, senha)
  const aptNumero = parseInt(apartamento, 10);

  if (!nome || !telefone || !apartamento || !email || !senha) {
    return res.status(400).json({ error: "Todos os campos são obrigatórios." });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: "E-mail inválido." });
  }

  if (isNaN(aptNumero) || aptNumero < 1) {
    return res.status(400).json({ error: "Apartamento inválido." });
  }

  const checkUser = "SELECT email, apartamento FROM usuario WHERE email = ? OR apartamento = ?";
  db.query(checkUser, [email, aptNumero], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Erro no servidor." });
    }

    if (results.length > 0) {
      if (results.some(r => r.email === email)) {
        return res.status(400).json({ error: "E-mail já cadastrado." });
      }
      if (results.some(r => r.apartamento === aptNumero)) {
        return res.status(400).json({ error: "Apartamento já cadastrado." });
      }
    }

    const insertUser =
      "INSERT INTO usuario (nome, email, telefone, apartamento, senha, adm) VALUES (?, ?, ?, ?, ?, ?)";
    db.query(insertUser, [nome, email, telefone, aptNumero, senha, true], err => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "Erro ao cadastrar usuário." });
      }

      const mailOptions = {
        from: 'no-reply@seudominio.com',
        to: email,
        subject: 'Bem-vindo ao Portal do Morador',
        text: `Olá ${nome},

Seja bem-vindo ao Portal do Morador! Acesse https://portal.condohub.com com seu e-mail e senha cadastrados.

Se precisar de ajuda, entre em contato com nossa equipe de suporte:
E-mail: suporte@condohub.com
Telefone: (11) 1234-5678

Atenciosamente,
Equipe do Condomínio`,
      };

      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.error('Erro ao enviar e-mail:', error);
          return res.status(200).json({ message: "Cadastro realizado com sucesso, mas falha ao enviar e-mail de boas-vindas." });
        }
        res.status(200).json({ message: "Cadastro realizado com sucesso! E-mail de boas-vindas enviado." });
      });
    });
  });
});

app.post("/registerVisitante", (req, res) => {
  const { nome, documento, dt_visita } = req.body;

  if (!nome || !documento || !dt_visita) {
    return res.status(400).json({ error: "Todos os campos são obrigatórios." });
  }

  if (!/^\d{11}$/.test(documento)) {
    return res.status(400).json({ error: "Documento inválido. Deve conter 11 dígitos." });
  }

  const visitaDate = new Date(dt_visita);
  if (isNaN(visitaDate.getTime())) {
    return res.status(400).json({ error: "Data de visita inválida." });
  }

  const insertVisitor = `
    INSERT INTO visitante (nome, documento, dt_visita) 
    VALUES (?, ?, ?)
  `;

  db.query(insertVisitor, [nome, documento, dt_visita], (err, result) => {
    if (err) {
      console.error("Erro ao inserir visitante:", err);
      return res.status(500).json({ error: "Erro ao cadastrar visitante." });
    }

    res.status(200).json({ message: "Cadastro de visitante realizado com sucesso!" });
  });
});


app.post("/reserva-area", (req, res) => {
  const { nome, data, horaInicio, horaFim, motivo } = req.body;

  const dt_inicio = `${data} ${horaInicio}`;
  const dt_fim = `${data} ${horaFim}`;

  const verificaConflito = `
    SELECT * FROM area 
    WHERE dt_inicio < ? AND dt_fim > ?
  `;

  db.query(verificaConflito, [dt_fim, dt_inicio], (err, results) => {
    if (err) {
      console.error("Erro ao verificar conflitos:", err);
      return res.status(500).json({ message: "Erro ao verificar conflitos" });
    }

    if (results.length > 0) {
      return res.status(400).json({ message: "Horário já reservado! Tente novamente com outro horário ou consulte a tabela pra verificar horários disponíveis" });
    }

    const inserirReserva = `
      INSERT INTO area (nome, dt_inicio, dt_fim, motivo) 
      VALUES (?, ?, ?, ?)
    `;

    db.query(inserirReserva, [nome, dt_inicio, dt_fim, motivo], (err, result) => {
      if (err) {
        console.error("Erro ao inserir reserva:", err);
        return res.status(500).json({ message: "Erro ao reservar" });
      }

      res.status(200).json({ message: "Reserva realizada com sucesso!" });
    });
  });
});


app.get("/reservas", (req, res) => {
  const query = `
    SELECT nome, dt_inicio AS horario_inicio, dt_fim AS horario_fim, motivo
    FROM area
    ORDER BY dt_inicio DESC
  `;

  db.query(query, (err, results) => {
    if (err) {
      console.error("Erro ao buscar reservas:", err);
      return res.status(500).json({ message: "Erro ao buscar reservas" });
    }
    res.json(results);
  });
});




app.listen(3001, () => {
  console.log("Servidor rodando na porta 3001");
});
