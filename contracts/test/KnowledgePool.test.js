const { expect } = require("chai");
const { ethers } = require("ethers");
const hre = require("hardhat");

describe("KnowledgePool", function () {
  let pool;
  let owner, proposer, validator, executor;
  const R = ethers.parseEther("0.001");

  beforeEach(async function () {
    [owner, proposer, validator, executor] = await hre.ethers.getSigners();
    const KnowledgePool = await hre.ethers.getContractFactory("KnowledgePool");
    pool = await KnowledgePool.deploy(R, R, R);
    await pool.waitForDeployment();
    await owner.sendTransaction({ to: await pool.getAddress(), value: ethers.parseEther("0.1") });
  });

  it("debería recibir fondos y registrar balance", async function () {
    expect(await pool.poolBalance()).to.equal(ethers.parseEther("0.1"));
    await pool.connect(proposer).fundPool({ value: ethers.parseEther("0.05") });
    expect(await pool.poolBalance()).to.equal(ethers.parseEther("0.15"));
  });

  it("debería proponer, validar, ejecutar y pagar recompensas", async function () {
    const poolBefore = await pool.poolBalance();
    const pBefore = await hre.ethers.provider.getBalance(proposer.address);
    const vBefore = await hre.ethers.provider.getBalance(validator.address);
    const eBefore = await hre.ethers.provider.getBalance(executor.address);

    await pool.connect(proposer).proposeKnowledge("test content");
    await pool.connect(validator).validateKnowledge(1);
    await pool.connect(executor).executeKnowledge(1);

    const poolAfter = await pool.poolBalance();
    const pAfter = await hre.ethers.provider.getBalance(proposer.address);
    const vAfter = await hre.ethers.provider.getBalance(validator.address);
    const eAfter = await hre.ethers.provider.getBalance(executor.address);

    const totalR = R * 3n;
    expect(poolBefore - poolAfter).to.equal(totalR);
    // Cada rol recibe R; como además pagan gas por su tx, el balance neto es R - gas
    expect(pAfter - pBefore).to.be.gte(R - ethers.parseEther("0.01"));
    expect(vAfter - vBefore).to.be.gte(R - ethers.parseEther("0.01"));
    expect(eAfter - eBefore).to.be.gte(R - ethers.parseEther("0.01"));
  });

  it("debería revertir si el pool no tiene balance suficiente", async function () {
    const Poor = await hre.ethers.getContractFactory("KnowledgePool");
    const poorPool = await Poor.deploy(R, R, R);
    await poorPool.waitForDeployment();
    await poorPool.connect(proposer).proposeKnowledge("x");
    await poorPool.connect(validator).validateKnowledge(1);
    await expect(poorPool.connect(executor).executeKnowledge(1)).to.be.revertedWithCustomError(poorPool, "InsufficientPoolBalance");
  });

  it("getKnowledge debe incluir executor tras ejecutar", async function () {
    await pool.connect(proposer).proposeKnowledge("data");
    await pool.connect(validator).validateKnowledge(1);
    let k = await pool.getKnowledge(1);
    expect(k.executor).to.equal(ethers.ZeroAddress);
    await pool.connect(executor).executeKnowledge(1);
    k = await pool.getKnowledge(1);
    expect(k.executor).to.equal(executor.address);
  });
});
