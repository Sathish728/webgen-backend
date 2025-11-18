
import Website from '../models/Website.model.js'

/**
 * Generate a URL-friendly slug from a string
 * @param {string} text - Text to convert to slug
 * @returns {string} - URL-friendly slug
 */
const generateSlug = (text) => {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
};

/**
 * Validate slug format
 * @param {string} slug - Slug to validate
 * @returns {boolean} - True if valid
 */
export function validateSlug  (slug)  {
  const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  return slugRegex.test(slug) && slug.length >= 3 && slug.length <= 100;
};

/**
 * Generate a unique slug for a user's website
 * @param {string} name - Website name
 * @param {string} userId - User ID
 * @returns {Promise<string>} - Unique slug
 */
export async function generateUniqueSlug   (name, userId) {
  let baseSlug = generateSlug(name);
  let slug = baseSlug;
  let counter = 1;

  // Keep trying until we find a unique slug for this user
  while (true) {
    const existing = await Website.findOne({ userId, slug });
    if (!existing) {
      return slug;
    }
    slug = `${baseSlug}-${counter}`;
    counter++;
  }
};

/**
 * Generate a random slug
 * @returns {string} - Random slug
 */
export function generateRandomSlug  ()  {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let slug = '';
  for (let i = 0; i < 8; i++) {
    slug += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return slug;
};