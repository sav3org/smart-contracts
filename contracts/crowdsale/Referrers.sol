pragma solidity ^0.5.17;

import "@openzeppelin/contracts/access/roles/WhitelistAdminRole.sol";

contract Referrers is WhitelistAdminRole {
    mapping(address => bool) private referrers;

    function addReferrers(address[] memory addresses) public onlyWhitelistAdmin {
        for (uint i = 0; i < addresses.length; i++) {
            referrers[addresses[i]] = true;
        }
    }

    function removeReferrers(address[] memory addresses) public onlyWhitelistAdmin {
        for (uint i = 0; i < addresses.length; i++) {
            referrers[addresses[i]] = false;
        }
    }

    function isReferrer(address _address) external view returns (bool) {
        return referrers[_address];
    }
}
