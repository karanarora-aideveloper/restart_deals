import mongoose from 'mongoose';

const masterSchema = new mongoose.Schema({
  type: { 
    type: String, 
    required: true, 
    index: true 
  }, // 'category', 'country', 'store'
  value: { 
    type: String, 
    required: true 
  }, // e.g., 'IN', 'electronics'
  label: { 
    type: String, 
    required: true 
  }, // e.g., 'India', 'Electronics'
  metadata: { 
    type: mongoose.Schema.Types.Mixed 
  }, // e.g. { currency: '₹', code: 'INR' }
  isActive: { 
    type: Boolean, 
    default: true 
  }
}, { timestamps: true });

masterSchema.index({ type: 1, value: 1 }, { unique: true });

const Master = mongoose.model('Master', masterSchema);
export default Master;
