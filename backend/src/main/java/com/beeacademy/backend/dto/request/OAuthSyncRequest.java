package com.beeacademy.backend.dto.request;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record OAuthSyncRequest(String fullName, String avatarUrl) {}
