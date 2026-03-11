import mongoose from 'mongoose';

const patternSchema = new mongoose.Schema({
  patternName: { type: String },
  weaverName: String,
  
  gridData: Array, 
  
  isPrivate: { type: Boolean, default: true },

  userId: String,
  creator: String,

  createdAt: { type: Date, default: Date.nows }
}, { strict: false }); 

export default mongoose.model('Pattern', patternSchema);
