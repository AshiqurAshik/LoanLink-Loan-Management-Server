// server.js
const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ================= JWT =================
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';

// ================= MongoDB =================
const uri = `mongodb+srv://${process.env.MONGO_USERNAME}:${process.env.MONGO_PASSWORD}@cluster0.4jfw6yd.mongodb.net/?appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

let loansCollection;
let applicationsCollection;
let usersCollection;

async function run() {
  try {
    await client.connect();
    const db = client.db();
    loansCollection = db.collection('Loans');
    applicationsCollection = db.collection('Applications');
    usersCollection = db.collection('Users');
    console.log('✅ MongoDB Connected');
  } catch (err) {
    console.error('❌ MongoDB Error:', err);
  }
}
run();

function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).send({ message: 'Unauthorized' });

  const token = authHeader.split(' ')[1];
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).send({ message: 'Forbidden' });
    req.user = decoded;
    next();
  });
}

app.get('/', (req, res) => {
  res.send('🚀 Server Running');
});

// =================================================
// AUTH
// =================================================

app.post('/register', async (req, res) => {
  const { name, email, password, role, photoURL } = req.body;

  if (!name || !email || !password) {
    return res.status(400).send({ message: 'Missing fields' });
  }

  const existingUser = await usersCollection.findOne({ email });
  if (existingUser) {
    return res.status(400).send({ message: 'User already exists' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const result = await usersCollection.insertOne({
    name,
    email,
    password: hashedPassword,
    role: role || 'borrower',
    photoURL,
    createdAt: new Date(),
  });

  res.send({ userId: result.insertedId });
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  // ---------------- Admin ----------------
  if (
    email === process.env.ADMIN_EMAIL &&
    password === process.env.ADMIN_PASSWORD
  ) {
    const token = jwt.sign({ email, role: 'admin' }, JWT_SECRET, {
      expiresIn: '1h',
    });
    return res.send({ email, role: 'admin', token });
  }

  const user = await usersCollection.findOne({ email });
  if (!user) return res.status(400).send({ message: 'Invalid credentials' });

  if (user.role.toLowerCase() === 'suspended') {
    return res.status(403).send({ message: 'Your account is suspended' });
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(400).send({ message: 'Invalid credentials' });

  const token = jwt.sign(
    { email: user.email, role: user.role, id: user._id },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  res.send({
    name: user.name,
    email: user.email,
    role: user.role,
    photoURL: user.photoURL,
    token,
  });
});

// ================= GET USER BY EMAIL =================
app.get('/users/by-email', async (req, res) => {
  const email = req.query.email?.trim();
  if (!email) return res.status(400).send({ message: 'Email is required' });

  try {
    const user = await usersCollection.findOne({ email });
    if (!user) return res.status(404).send({ message: 'User not found' });

    res.send([user]);
  } catch (err) {
    console.error('Error fetching user by email:', err);
    res.status(500).send({ message: 'Server error' });
  }
});

// =================================================
// LOANS
// =================================================

app.get('/loans', async (req, res) => {
  const loans = await loansCollection.find().toArray();
  res.send(loans);
});

app.get('/loans/:id', async (req, res) => {
  const loan = await loansCollection.findOne({
    _id: new ObjectId(req.params.id),
  });
  res.send(loan);
});

app.post('/loans', async (req, res) => {
  try {
    const loanData = { ...req.body, createdAt: new Date() };
    const result = await loansCollection.insertOne(loanData);
    res.send({ message: 'Loan added successfully', loanId: result.insertedId });
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: 'Failed to add loan' });
  }
});

app.patch('/loans/:id', async (req, res) => {
  try {
    const loanId = req.params.id;
    const updateData = { ...req.body, updatedAt: new Date() };

    const result = await loansCollection.updateOne(
      { _id: new ObjectId(loanId) },
      { $set: updateData }
    );

    if (result.matchedCount === 0)
      return res.status(404).send({ message: 'Loan not found' });

    res.send({ message: 'Loan updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: 'Failed to update loan' });
  }
});

app.delete('/loans/:id', async (req, res) => {
  try {
    const loanId = req.params.id;
    const result = await loansCollection.deleteOne({
      _id: new ObjectId(loanId),
    });

    if (result.deletedCount === 0)
      return res.status(404).send({ message: 'Loan not found' });

    res.send({ message: 'Loan deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: 'Failed to delete loan' });
  }
});

// =================================================
// APPLICATIONS
// =================================================


app.get('/applications', async (req, res) => {
  const apps = await applicationsCollection.find().toArray();
  res.send(apps);
});

app.get('/applications/:id', async (req, res) => {
  try {
    const appData = await applicationsCollection.findOne({
      _id: new ObjectId(req.params.id),
    });
    res.send(appData);
  } catch {
    res.status(400).send({ message: 'Invalid ID' });
  }
});

app.patch('/applications/:id', async (req, res) => {
  const { status, comments, feeStatus } = req.body;

  await applicationsCollection.updateOne(
    { _id: new ObjectId(req.params.id) },
    {
      $set: {
        ...(status && { status }),
        ...(comments && { comments }),
        ...(feeStatus && { feeStatus }),
        updatedAt: new Date(),
      },
    }
  );

  res.send({ message: 'Application updated' });
});

// =================================================
// USERS (ADMIN)
// =================================================

app.get('/users', verifyJWT, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).send({ message: 'Admins only' });
  }

  const users = await usersCollection
    .find({ role: { $in: ['borrower', 'manager'] } })
    .toArray();

  res.send(users);
});

app.get('/users/me', async (req, res) => {
  try {
    const user = await usersCollection.findOne({ role: 'manager' });
    if (!user) return res.status(404).send({ message: 'Manager not found' });
    res.send(user);
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: 'Server error' });
  }
});

app.patch('/users/:id', verifyJWT, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).send({ message: 'Admins only' });
  }

  const { id } = req.params;
  const { role, suspendReason, suspendFeedback } = req.body;

  if (!role) return res.status(400).send({ message: 'Role is required' });

  try {
    const updateFields = { role };

    if (role === 'suspended') {
      updateFields.suspendReason = suspendReason || '';
      updateFields.suspendFeedback = suspendFeedback || '';
    } else {
      updateFields.suspendReason = '';
      updateFields.suspendFeedback = '';
    }

    const result = await usersCollection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: updateFields },
      { returnDocument: 'after' }
    );

    if (!result.value)
      return res.status(404).send({ message: 'User not found' });

    res.send(result.value);
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: 'Failed to update user' });
  }
});

// ================= START =================
app.listen(port, () => {
  console.log(`✅ Server running on port ${port}`);
});
