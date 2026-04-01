import { PrismaClient, EventCategory, EventStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@projectalfa.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'Admin123!';
const ADMIN_NAME = 'Project Alfa Admin';

// Seed events mirror ProjectAlfaFE/src/data/events.json for visual continuity (D-03)
// Backend-specific fields added per D-04: start_time, duration_minutes, capacity, status
// IDs are stable short strings to make upsert idempotent across re-runs
const SEED_EVENTS = [
  {
    id: 'seed-evt-music-neon',
    title: 'Neon Nights Music Festival',
    description:
      'An electrifying night of live music, light shows, and unforgettable energy.',
    category: EventCategory.MUSIC,
    price: 45,
    date: new Date('2026-03-15'),
    start_time: '18:00',
    duration_minutes: 180,
    capacity: 250,
    status: EventStatus.PUBLISHED,
    location: 'Central Arena, Downtown',
    image_url:
      'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=600&h=400&fit=crop',
  },
  {
    id: 'seed-evt-tech-ai',
    title: 'Future of AI Summit',
    description:
      'A deep dive into artificial intelligence, featuring industry leaders and live demos.',
    category: EventCategory.TECH,
    price: 120,
    date: new Date('2026-04-02'),
    start_time: '09:00',
    duration_minutes: 480,
    capacity: 120,
    status: EventStatus.PUBLISHED,
    location: 'Innovation Hub, Tech District',
    image_url:
      'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=600&h=400&fit=crop',
  },
  {
    id: 'seed-evt-art-visions',
    title: 'Contemporary Visions Exhibition',
    description:
      'A curated gallery showcasing emerging artists redefining modern art.',
    category: EventCategory.ART,
    price: 25,
    date: new Date('2026-03-22'),
    start_time: '10:00',
    duration_minutes: 360,
    capacity: 200,
    status: EventStatus.PUBLISHED,
    location: 'Gallery Row, Arts Quarter',
    image_url:
      'https://images.unsplash.com/photo-1536924940846-227afb31e2a5?w=600&h=400&fit=crop',
  },
  {
    id: 'seed-evt-food-street',
    title: 'Street Food Festival',
    description:
      'Taste the world with 50+ food vendors, live cooking demos, and craft drinks.',
    category: EventCategory.FOOD,
    price: 15,
    date: new Date('2026-04-10'),
    start_time: '12:00',
    duration_minutes: 360,
    capacity: 600,
    status: EventStatus.PUBLISHED,
    location: 'Riverside Park',
    image_url:
      'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=600&h=400&fit=crop',
  },
  {
    id: 'seed-evt-wellness-yoga',
    title: 'Sunrise Yoga Retreat',
    description:
      'Reconnect with nature through guided yoga, meditation, and breathwork.',
    category: EventCategory.WELLNESS,
    price: 60,
    date: new Date('2026-03-29'),
    start_time: '06:30',
    duration_minutes: 120,
    capacity: 50,
    status: EventStatus.PUBLISHED,
    location: 'Lakeview Retreat Center',
    image_url:
      'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=600&h=400&fit=crop',
  },
  {
    id: 'seed-evt-ent-comedy',
    title: 'Late Night Comedy Club',
    description:
      'An intimate evening of stand-up comedy featuring rising stars and surprise guests.',
    category: EventCategory.ENTERTAINMENT,
    price: 30,
    date: new Date('2026-04-05'),
    start_time: '21:00',
    duration_minutes: 120,
    capacity: 80,
    status: EventStatus.PUBLISHED,
    location: 'The Basement Club, Old Town',
    image_url:
      'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&h=400&fit=crop',
  },
  {
    id: 'seed-evt-music-jazz',
    title: 'Jazz Under the Stars',
    description:
      'Open-air jazz concert with local and international musicians under the night sky.',
    category: EventCategory.MUSIC,
    price: 55,
    date: new Date('2026-04-18'),
    start_time: '19:30',
    duration_minutes: 150,
    capacity: 150,
    status: EventStatus.PUBLISHED,
    location: 'City Roof Garden',
    image_url:
      'https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?w=600&h=400&fit=crop',
  },
  {
    id: 'seed-evt-tech-startup',
    title: 'Startup Pitch Night',
    description:
      'Watch founders pitch to investors. Network and discover the next big idea.',
    category: EventCategory.TECH,
    price: 35,
    date: new Date('2026-03-28'),
    start_time: '18:00',
    duration_minutes: 180,
    capacity: 120,
    status: EventStatus.PUBLISHED,
    location: 'Co-Work Space, Innovation Center',
    image_url:
      'https://images.unsplash.com/photo-1552664730-d307ca884978?w=600&h=400&fit=crop',
  },
  {
    id: 'seed-evt-ent-beer',
    title: 'Craft Beer & Live Acoustic',
    description:
      'Local breweries, live acoustic sets, and food trucks in a relaxed outdoor setting.',
    category: EventCategory.ENTERTAINMENT,
    price: 20,
    date: new Date('2026-04-12'),
    start_time: '16:00',
    duration_minutes: 240,
    capacity: 220,
    status: EventStatus.PUBLISHED,
    location: 'Harbor Yard',
    image_url:
      'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=600&h=400&fit=crop',
  },
];

async function main() {
  // Seed admin user
  console.log('Seeding admin user...');
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  await prisma.admin.upsert({
    where: { email: ADMIN_EMAIL },
    update: {},
    create: {
      email: ADMIN_EMAIL,
      password_hash: passwordHash,
      name: ADMIN_NAME,
    },
  });
  console.log(`Seeded admin: ${ADMIN_EMAIL}`);

  // Seed events
  console.log('Seeding events...');
  for (const event of SEED_EVENTS) {
    await prisma.event.upsert({
      where: { id: event.id },
      update: {}, // No updates on re-run — seed data is stable
      create: event,
    });
  }
  console.log(`Seeded ${SEED_EVENTS.length} events.`);
}

main()
  .catch(console.error)
  .finally(() => {
    void prisma.$disconnect();
  });
