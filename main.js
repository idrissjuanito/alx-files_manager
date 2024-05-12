import dbClient from "./utils/db";

const waitConnection = () => {
  return new Promise((resolve, reject) => {
    let i = 0;
    const repeatFct = async () => {
      await setTimeout(() => {
        i += 1;
        if (i >= 10) {
          reject();
        } else if (!dbClient.isAlive()) {
          repeatFct();
        } else {
          resolve();
        }
      }, 1000);
    };
    repeatFct();
  });
};

(async () => {
  console.log(dbClient.isAlive());
  await waitConnection();
  const users = dbClient.db.collection("users");
  const found = await users.findOne({ email: "idrisstest@yopmail.com" });
  const res = await users.insertOne({
    email: "somemail@yopmail.com",
    password: "retrieve",
  });
  console.log(res.result);
  console.log(dbClient.isAlive());
  console.log(await dbClient.nbUsers());
  console.log(await dbClient.nbFiles());
})();
