// SPDX-License-Identifier: MIT
pragma solidity 0.8.6;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

struct BridgeUpdate {
    address newBridge;
    uint256 endGracePeriod;
    bool executed;
}

contract TotemToken is ERC20, Ownable {
    address private bridge;
    BridgeUpdate private bridgeUpdate = BridgeUpdate(address(0), 0, true);

    event BridgeUpdateLaunched(address newBridge, uint256 endGracePeriod);

    event BridgeUpdateExecuted(address newBridge);

    modifier onlyBridge() {
        require(msg.sender == bridge, "TotemToken: access denied");
        _;
    }

    constructor(
        string memory name,
        string memory symbol,
        uint256 initialSupply
    ) ERC20(name, symbol) {
        _mint(msg.sender, initialSupply);
    }

    function getBridge() external view returns (address) {
        return bridge;
    }

    function getBridgeUpdate() external view returns (BridgeUpdate memory) {
        return bridgeUpdate;
    }

    function launchBridgeUpdate(address newBridge) external onlyOwner {
        require(
            bridgeUpdate.executed,
            "TotemToken: current update not yet executed"
        );

        uint256 endGracePeriod = block.timestamp + 604800; // 604800 = 7 days

        bridgeUpdate = BridgeUpdate(newBridge, endGracePeriod, false);

        emit BridgeUpdateLaunched(newBridge, endGracePeriod);
    }

    function executeBridgeUpdate() external onlyOwner {
        require(
            bridgeUpdate.endGracePeriod <= block.timestamp,
            "TotemToken: grace period has not finished"
        );
        require(
            bridgeUpdate.executed == false,
            "TotemToken: update already executed"
        );

        bridgeUpdate.executed = true;
        bridge = bridgeUpdate.newBridge;

        emit BridgeUpdateExecuted(bridgeUpdate.newBridge);
    }

    function mintFromBridge(address account, uint256 amount)
        external
        onlyBridge
    {
        _mint(account, amount);
    }

    function burnFromBridge(address account, uint256 amount)
        external
        onlyBridge
    {
        _burn(account, amount);
    }
}
