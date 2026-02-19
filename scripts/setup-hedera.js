import dotenv from "dotenv";
import { Client, AccountId, PrivateKey, AccountBalanceQuery } from "@hashgraph/sdk";
import fs from "fs";
import path from "path";

dotenv.config();

async function setupHedera() {
  console.log("Configurando entorno de Hedera...");

  try {
    // Validar variables de entorno
    if (!process.env.HEDERA_ACCOUNT_ID || !process.env.HEDERA_PRIVATE_KEY) {
      throw new Error("HEDERA_ACCOUNT_ID y HEDERA_PRIVATE_KEY deben estar configurados en .env");
    }

    const accountId = AccountId.fromString(process.env.HEDERA_ACCOUNT_ID);
    const privateKey = PrivateKey.fromString(process.env.HEDERA_PRIVATE_KEY);
    const network = process.env.HEDERA_NETWORK || "testnet";

    // Crear cliente de Hedera
    const client = Client.forName(network);
    client.setOperator(accountId, privateKey);

    console.log(`✓ Cliente de Hedera configurado para ${network}`);
    console.log(`✓ Cuenta: ${accountId.toString()}`);

    // Verificar balance
    const balance = await new AccountBalanceQuery().setAccountId(accountId).execute(client);
    console.log(`✓ Balance: ${balance.hbars.toString()} HBAR`);

    console.log("\n✓ Configuración de Hedera completada exitosamente");
    
    client.close();
  } catch (error) {
    console.error("Error al configurar Hedera:", error.message);
    process.exit(1);
  }
}

setupHedera();
