// Generate 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Generate random password (8-12 characters with mix of letters, numbers, and symbols)
const generateRandomPassword = () => {
  const length = Math.floor(Math.random() * 5) + 8; // 8-12 characters
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*';
  
  const allChars = lowercase + uppercase + numbers + symbols;
  
  let password = '';
  
  // Ensure at least one of each type
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];
  
  // Fill the rest randomly
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  
  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
};

// Validate email format
const isValidEmail = (email) => {
  const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
  return emailRegex.test(email);
};

// Validate password strength
const isStrongPassword = (password) => {
  if (!password || password.length < 6) {
    return { valid: false, message: 'Password must be at least 6 characters long' };
  }
  
  // Optional: Add more strength checks
  if (password.length < 8) {
    return { 
      valid: true, 
      message: 'Password is weak. Consider using at least 8 characters with mix of letters, numbers, and symbols' 
    };
  }
  
  return { valid: true, message: 'Password is acceptable' };
};

// Check if OTP is expired
const isOTPExpired = (otpExpiry) => {
  if (!otpExpiry) return true;
  return new Date() > new Date(otpExpiry);
};

module.exports = {
  generateOTP,
  generateRandomPassword,
  isValidEmail,
  isStrongPassword,
  isOTPExpired
};
