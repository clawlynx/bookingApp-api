require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const User = require("./models/User");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const downloader = require("image-downloader");
const multer = require("multer");
const Place = require("./models/Place");
const Booking = require("./models/Booking");
const saltRounds = 10;
const jwtSecret = process.env.JWT_SECRET;

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use("/uploads", express.static(__dirname + "/uploads"));
//configuring multer
const storage = multer.diskStorage({
  destination: "uploads/",
  filename: function (req, file, cb) {
    // Generate a unique filename
    const uniqueSuffix = "photo" + Date.now();
    cb(null, uniqueSuffix + "." + file.originalname.split(".").pop());
  },
});

const upload = multer({ storage: storage });
app.use(express.json()); //for accessing the body of request send using axios
// for connecting front end and backend ports
app.use(
  cors({
    credentials: true,
    origin: "https://bookingapp-client.onrender.com",
  })
);
app.use(cookieParser());

mongoose.connect(process.env.MONGODB_CONNECTION_STRING);

app.get("/test", (req, res) => {
  res.json("test ok");
});
//for sending userdata from the token to front end for showing username afterrefreshing
app.get("/profile", (req, res) => {
  //console.log(req.cookies);
  const { token } = req.cookies;
  if (!token) {
    res.json(null);
    return;
  } else {
    //verifying the token send from //frontend and sending userdata
    jwt.verify(token, jwtSecret, {}, (err, data) => {
      if (err) throw err;
      res.json(data);
    });
  }
});

app.post("/register", (req, res) => {
  const { name, email, password } = req.body;
  const run = async () => {
    try {
      const newUser = new User({
        name: name,
        email: email,
        password: bcrypt.hashSync(password, saltRounds), //password hashing
      });
      await newUser.save();
      res.json(newUser);
    } catch (error) {
      res.status(422).json(error);
    }
  };
  run();
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const currentUser = await User.findOne({ email: email });
    if (currentUser) {
      const passOk = bcrypt.compareSync(password, currentUser.password); //password comparing/checking
      if (passOk) {
        // creating token using jwt
        jwt.sign(
          {
            email: currentUser.email,
            id: currentUser._id,
            name: currentUser.name,
          },
          jwtSecret,
          {},
          (err, token) => {
            if (err) throw err;
            res
              .cookie("token", token, {
                httpOnly: false,
                sameSite: "none",
                secure: true,
              }) //creating cookie using jwt token
              .json(currentUser);
          }
        );
      } else {
        res.status(422).json("pass not ok");
      }
    } else {
      res.status(422).json("user not found");
    }
  } catch (error) {
    console.log(error);
  }
});

app.post("/logout", (req, res) => {
  res
    .cookie("token", "", {
      expires: new Date(0),
      sameSite: "none",
      secure: true,
    })
    .json(true);
});
//route for adding images using link
app.post("/upload-by-link", async (req, res) => {
  const { link } = req.body;
  const newName = "photo" + Date.now() + ".jpg";
  try {
    await downloader.image({
      url: link,
      dest: __dirname + "/uploads/" + newName,
    });
    res.json(newName);
  } catch (error) {
    console.log(error);
  }
});

//route for local upload of images using multer
app.post("/upload", upload.single("photo"), (req, res) => {
  const file = req.file;
  res.json(file);
});

//route for creating places
app.post("/places", (req, res) => {
  const {
    title,
    address,
    photos,
    description,
    perks,
    extraInfo,
    checkIn,
    checkOut,
    maxGuests,
    price,
  } = req.body;
  const { token } = req.cookies;
  const lowerAdress = address.toLowerCase();
  const keywords = lowerAdress.split(/[, ]+/);
  jwt.verify(token, jwtSecret, {}, async (err, data) => {
    if (err) throw err;
    const newPlace = new Place({
      title,
      address,
      photos,
      description,
      perks,
      extraInfo,
      price,
      keywords,
      checkIn,
      checkOut,
      maxGuests,
      owner: data.id,
    });
    await newPlace.save();
    res.json(newPlace);
  });
});
//route for rendering existing places for my accomodation
app.get("/places", (req, res) => {
  const { token } = req.cookies;
  jwt.verify(token, jwtSecret, {}, async (err, data) => {
    if (err) throw err;
    const places = await Place.find({ owner: data.id });
    res.json(places);
  });
});
//route for updating existing place
app.get("/places/:id", (req, res) => {
  const { token } = req.cookies;
  const { id } = req.params;

  jwt.verify(token, jwtSecret, {}, async (err, data) => {
    if (err) throw err;
    if (data) {
      const placeToEdit = await Place.findById(id);
      res.json(placeToEdit);
    }
  });
});
//route for updating to database
app.put("/places", (req, res) => {
  const { token } = req.cookies;
  const {
    id,
    title,
    address,
    description,
    photos,
    perks,
    extraInfo,
    price,
    maxGuests,
    checkIn,
    checkOut,
  } = req.body;
  const lowerAdress = address.toLowerCase();
  const keywords = lowerAdress.split(/[, ]+/);
  jwt.verify(token, jwtSecret, {}, async (err, data) => {
    if (err) throw err;
    if (data) {
      const updatePlace = await Place.replaceOne(
        { _id: id },
        {
          title: title,
          address: address,
          description: description,
          photos: photos,
          perks: perks,
          extraInfo: extraInfo,
          maxGuests: maxGuests,
          keywords: keywords,
          checkIn: checkIn,
          price: price,
          checkOut: checkOut,
          owner: data.id,
        }
      );
      res.json(updatePlace);
    } else {
      res.json("error");
    }
  });
});
//route for homepage
app.get("/home", async (req, res) => {
  res.json(await Place.find());
});
//route for singlepage
app.get("/home/:id", async (req, res) => {
  const { id } = req.params;
  res.json(await Place.findById(id));
});

//route for booking
app.post("/bookings", (req, res) => {
  const { token } = req.cookies;
  const {
    place,
    customerCheckIn,
    customerCheckOut,
    guests,
    name,
    phone,
    price,
  } = req.body;
  jwt.verify(token, jwtSecret, {}, async (err, data) => {
    if (err) throw err;
    if (data) {
      const newbooking = new Booking({
        place,
        owner: data.id,
        customerCheckIn,
        customerCheckOut,
        guests,
        name,
        phone,
        price,
      });
      await newbooking.save();
      res.json(newbooking);
    }
  });
});
//route for rendering all the bookings
app.get("/bookings", (req, res) => {
  const { token } = req.cookies;
  jwt.verify(token, jwtSecret, {}, async (err, data) => {
    if (err) throw err;
    if (data) {
      const allBookings = await Booking.find({ owner: data.id }).populate(
        "place"
      );
      res.json(allBookings);
    }
  });
});
//route for rendering single booking
app.get("/bookings/:placeid", (req, res) => {
  const { placeid } = req.params;
  console.log(placeid);
  const { token } = req.cookies;
  jwt.verify(token, jwtSecret, {}, async (err, data) => {
    if (err) throw err;
    if (data) {
      const bookedPlace = await Booking.findOne({ place: placeid }).populate(
        "place"
      );
      res.json(bookedPlace);
    }
  });
});
//route for searching a specific location
app.get("/search/:key", async (req, res) => {
  const { key } = req.params;
  const query = key.toLowerCase();
  console.log(query);
  const searchedPlaces = await Place.find({ keywords: { $in: [query] } });
  if (searchedPlaces) {
    res.json(searchedPlaces);
  } else {
    res.json("not found");
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log("connected to server 3000");
});
