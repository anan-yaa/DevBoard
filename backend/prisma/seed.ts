import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create a sample room with initial code
  const sampleRoom = await prisma.room.upsert({
    where: { id: 'sample-room' },
    update: {},
    create: {
      id: 'sample-room',
      code: `// Welcome to DevBoard!
// This is a sample collaborative coding room.

function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

console.log('Fibonacci of 10:', fibonacci(10));

// Start editing and share the room ID to collaborate!`,
    },
  });

  // Add sample comments
  await prisma.comment.createMany({
    data: [
      {
        roomId: sampleRoom.id,
        userId: 'system',
        username: 'System',
        lineNumber: 1,
        text: 'Welcome to DevBoard! This is a collaborative code editor.',
      },
      {
        roomId: sampleRoom.id,
        userId: 'system',
        username: 'System',
        lineNumber: 8,
        text: 'Try running this function to see the result!',
      },
    ],
    skipDuplicates: true,
  });

  console.log('✅ Database seeded successfully');
  console.log(`📝 Sample room created: ${sampleRoom.id}`);
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
