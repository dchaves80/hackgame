-- Create hackergame_auth database if it doesn't exist
IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'hackergame_auth')
BEGIN
    CREATE DATABASE hackergame_auth;
END
GO

USE hackergame_auth;
GO

-- Create Users table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Users')
BEGIN
    CREATE TABLE Users (
        id INT PRIMARY KEY IDENTITY(1,1),
        username NVARCHAR(50) NOT NULL UNIQUE,
        email NVARCHAR(100) NOT NULL UNIQUE,
        password_hash NVARCHAR(255) NOT NULL,
        created_at DATETIME NOT NULL DEFAULT GETDATE(),
        last_login DATETIME NULL,
        is_active BIT NOT NULL DEFAULT 1,
        INDEX IX_Users_Email (email),
        INDEX IX_Users_Username (username)
    );
END
GO

-- Create Sessions table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Sessions')
BEGIN
    CREATE TABLE Sessions (
        id INT PRIMARY KEY IDENTITY(1,1),
        user_id INT NOT NULL,
        token NVARCHAR(MAX) NOT NULL,
        expires_at DATETIME NOT NULL,
        ip_address NVARCHAR(45) NULL,
        user_agent NVARCHAR(255) NULL,
        created_at DATETIME NOT NULL DEFAULT GETDATE(),
        FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE,
        INDEX IX_Sessions_UserId (user_id),
        INDEX IX_Sessions_ExpiresAt (expires_at)
    );
END
GO

PRINT 'Database initialization completed successfully!';
