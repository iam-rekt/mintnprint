export default function handler(req, res) {
  res.status(200).json({
    name: "MintNPrint",
    description: "Mint and print your favorite NFTs",
    image: "https://mintnprintv1-one.vercel.app/welcome.png",
    url: "https://mintnprintv1-one.vercel.app",
    frames: {
      version: "next",
      home: "https://mintnprintv1-one.vercel.app"
    }
  });
} 