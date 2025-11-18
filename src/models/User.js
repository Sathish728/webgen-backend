import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    fullName:{
        type:String,
        required:true,
    },

     email:{
        type:String,
        required:true,
        unique:true,
    },

     password:{
        type:String,
        required:true,
        minlength:6
    },

     
    isEmailVerified: {
        type: Boolean,
        default: false
    },
    emailVerificationToken: {
        type: String,
        default: null
    },
    emailVerificationExpires: {
        type: Date,
        default: null
    },
   
    passwordResetToken: {
        type: String,
        default: null
    },
    passwordResetExpires: {
        type: Date,
        default: null
    },

    
    verificationAttempts: {
        type: Number,
        default: 0
    },
    lastVerificationAttempt: {
        type: Date,
        default: null
    }
}, 
{ timestamps: true })

// Index for faster queries
// userSchema.index({ email: 1 });
userSchema.index({ emailVerificationToken: 1 });
userSchema.index({ passwordResetToken: 1 });

const User = mongoose.model("User", userSchema)
export default User