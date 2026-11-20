package com.mordi.backend.dto;

import lombok.Data;

@Data
public class DeleteAccountRequest {

    // Required of everyone but a guest, who never had one: AccountService
    // checks it, since only it knows which this account is.
    private String password;
}
