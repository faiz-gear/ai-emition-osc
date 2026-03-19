import unittest


class ProviderCryptoTests(unittest.TestCase):
    def test_encrypt_decrypt_json_roundtrip(self):
        from server.app.providers.crypto import ProviderCrypto

        crypto = ProviderCrypto("0123456789abcdef0123456789abcdef")
        ciphertext = crypto.encrypt_json({"Authorization": "Bearer x"})
        plaintext = crypto.decrypt_json(ciphertext)
        self.assertEqual(plaintext["Authorization"], "Bearer x")

    def test_encrypt_decrypt_text_roundtrip(self):
        from server.app.providers.crypto import ProviderCrypto

        crypto = ProviderCrypto("0123456789abcdef0123456789abcdef")
        ciphertext = crypto.encrypt_text("secret-value")
        plaintext = crypto.decrypt_text(ciphertext)
        self.assertEqual(plaintext, "secret-value")

    def test_decrypt_with_wrong_key_raises(self):
        from server.app.providers.crypto import ProviderCrypto

        good_crypto = ProviderCrypto("0123456789abcdef0123456789abcdef")
        bad_crypto = ProviderCrypto("abcdef0123456789abcdef0123456789")
        ciphertext = good_crypto.encrypt_text("secret-value")
        with self.assertRaises(ValueError):
            bad_crypto.decrypt_text(ciphertext)

    def test_decrypt_malformed_payload_raises(self):
        from server.app.providers.crypto import ProviderCrypto

        crypto = ProviderCrypto("0123456789abcdef0123456789abcdef")
        with self.assertRaises(ValueError):
            crypto.decrypt_text("{not-json")


if __name__ == "__main__":
    unittest.main()
