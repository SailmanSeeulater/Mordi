package com.mordi.backend.dto;

import lombok.Data;

/** Starting a "Try it" account. Both fields may be left out. */
@Data
public class GuestRequest {

    // IANA zone from the browser, so the sample week falls on the person's
    // own days. Anything unrecognised is read as UTC.
    private String timeZone;

    // False starts the account empty; anything else fills in a sample week.
    private Boolean sample;
}
