const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
var jwt = require("jsonwebtoken");

//middleware
app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header) {
    return res.status(401).send({ message: "Unauthorized Access" });
  }
  const token = header.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: "forbidden Access" });
    }
    req.decoded = decoded;
    next();
  });
};

//root
app.get("/", (req, res) => {
  res.send("budget cars server is ready to use");
});

//mongodb
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.t3mwvsa.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

async function run() {
  try {
    const allAccountsCollection = client
      .db("budgetCarsDB")
      .collection("allAccounts");
    const carModelsCollection = client
      .db("budgetCarsDB")
      .collection("carsModel");
    const allCarCollection = client.db("budgetCarsDB").collection("allCar");

    //all user account
    app.post("/allAccounts", async (req, res) => {
      const newlyCreatedAccount = req.body;
      const result = await allAccountsCollection.insertOne(newlyCreatedAccount);
      res.send(result);
    });

    //jwt
    app.post("/jwt", (req, res) => {
      const user = req.body;
      console.log(user);
      const token = jwt.sign(user, process.env.ACCESS_TOKEN, {
        expiresIn: "1h",
      });
      res.send({ token });
    });
    //carModel
    app.get("/carModels", async (req, res) => {
      const query = {};
      const result = await carModelsCollection.find(query).toArray();
      res.send(result);
    });

    //single model api
    app.get('/carModels/:model', async (req, res) => {
      const model = req.params.model
      const query = { model: model }
      const sameModelCars = await allCarCollection.find(query).toArray()
      
     let result = await Promise.all( sameModelCars.map(async(car) => {
        const filter = { userEmail: car.sellerEmail }
        const seller = await allAccountsCollection.findOne(filter)
        
        car.sellerStatus = seller.sellerStatus
        return car
     }))
    
      console.log(result)
      res.send(result)
    })

    //all car of every model
    app.post("/allCar", async (req, res) => {
      const data = req.body;
      const result = await allCarCollection.insertOne(data);
      res.send(result);
    });

    //my products
    app.post("/products", verifyJWT, async (req, res) => {
      const email = req.body.email;
      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res.status(403).send({ message: "forbidden Access" });
      }
      console.log(decodedEmail);
      const emailQuery = { userEmail: email };
      const userData = await allAccountsCollection.findOne(emailQuery);
      if (userData?.accountStatus !== "seller") {
        return res.status(403).send({ message: "forbidden Access" });
      }

      const query = {};
      const products = await allCarCollection.find(query).toArray();

      res.send(products);
    });
    //product advertise
    app.put("/products/advertise/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          status: "advertised",
        },
      };
      const result = await allCarCollection.updateOne(
        query,
        updateDoc,
        options
      );
      res.send(result);
    });
    //advertised product load api
    app.get('/products/advertise', async (req, res) => {
      const query = {};
      const allCar = await allCarCollection.find(query).toArray();
      const advertisedProducts = allCar.filter((car) => car.status === "advertised");
      res.send(advertisedProducts);
    })
    //product delete
    app.delete("/products/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;

      const query = { _id: ObjectId(id) };
      const result = await allCarCollection.deleteOne(query);
      res.send(result);
    });

    //admin verify
    app.get("/admin/:email", async (req, res) => {
      const email = req.params.email;
      const emailQuery = { userEmail: email };
      const user = await allAccountsCollection.findOne(emailQuery);
      if (user?.accountStatus === "admin") {
        res.send({ isAdmin: true });
      }
    });

    //seller verify
    app.get("/seller/:email", async (req, res) => {
      const email = req.params.email;
      const emailQuery = { userEmail: email };
      const user = await allAccountsCollection.findOne(emailQuery);

      if (user?.accountStatus === "seller") {
        res.send({ isSeller: true });
      }
    });

    //all seller
    app.post("/sellers", verifyJWT, async (req, res) => {
      const email = req.body.email;
      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res.status(403).send({ message: "forbidden Access" });
      }
      console.log(decodedEmail);
      const emailQuery = { userEmail: email };
      const userData = await allAccountsCollection.findOne(emailQuery);
      if (userData?.accountStatus !== "admin") {
        return res.status(403).send({ message: "forbidden Access" });
      }

      const query = {};
      const allAccounts = await allAccountsCollection.find(query).toArray();
      const sellers = allAccounts.filter((d) => d.accountStatus === "seller");
      res.send(sellers);
    });

    //seller status verification api
    app.put("/sellers/verifyStatus/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const options = { upsert: true };
      const updateDoc = {
        $set: req.body,
      };
      const result = await allAccountsCollection.updateOne(
        query,
        updateDoc,
        options
      );
      res.send(result);
    });
    //seller delete api
    app.delete("/sellers/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;

      const query = { _id: ObjectId(id) };
      const result = await allAccountsCollection.deleteOne(query);
      res.send(result);
    });

    //all buyers
    app.post("/buyers", verifyJWT, async (req, res) => {
      const email = req.body.email;
      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res.status(403).send({ message: "forbidden Access" });
      }
      console.log(decodedEmail);
      const emailQuery = { userEmail: email };
      const userData = await allAccountsCollection.findOne(emailQuery);
      if (userData?.accountStatus !== "admin") {
        return res.status(403).send({ message: "forbidden Access" });
      }
      const query = {};
      const data = await allAccountsCollection.find(query).toArray();
      const buyers = data.filter((d) => d.accountStatus === "buyer");
      res.send(buyers);
    });

    //buyer delete
    app.delete("/buyers/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await allAccountsCollection.deleteOne(query);
      res.send(result);
    });
  } finally {
  }
}
run().catch((err) => console.log(err));

client.connect((err) => {
  console.log(err);
});

app.listen(port, () => {
  console.log("server is running at port", port);
});
