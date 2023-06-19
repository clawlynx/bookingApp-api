const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema({
  place: { type: mongoose.Schema.Types.ObjectId, required: true, ref: "Place" },
  owner: { type: mongoose.Schema.Types.ObjectId, required: true },
  customerCheckIn: { type: Date, required: true },
  customerCheckOut: { type: Date, required: true },
  guests: { type: Number, required: true },
  name: { type: String, required: true },
  phone: { type: String, required: true },
  price: { type: String, required: true },
});

const Booking = mongoose.model("Booking", bookingSchema);

module.exports = Booking;
