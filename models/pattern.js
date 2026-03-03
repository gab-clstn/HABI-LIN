import mongoose from 'mongoose';

const patternSchema = new mongoose.Schema({
  patternName: { type: String, required: true },
  weaverName: String,
  // Storing the design as a grid or coordinates for your 3D loom
  gridData: Array, 
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Pattern', patternSchema);