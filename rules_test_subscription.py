#!/usr/bin/env python3
"""Prova delle regole del database sull'abbonamento Pro (users, subscriptions e nodi riservati al server).

Uso (dalla cartella firebase):
    firebase emulators:start --only auth,database &      # in un altro terminale
    python3 rules_test_subscription.py

Crea due utenti nell'emulatore Auth e tenta scritture e letture consentite e vietate: esce con codice 1 se
anche una sola si comporta in modo diverso dal previsto.
"""
import json
import sys
import urllib.error
import urllib.request

NS = "project-1647827934304323079"
AUTH = "http://127.0.0.1:9099"
DB = "http://127.0.0.1:9000"
OK, DENIED = "OK", "NEGATO"


def post(url, body):
    r = urllib.request.Request(url, data=json.dumps(body).encode(), method="POST", headers={"Content-Type": "application/json"})
    return json.loads(urllib.request.urlopen(r).read())


def new_user(email):
    r = post(f"{AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake",
             {"email": email, "password": "Pwd1!abcdef", "returnSecureToken": True})
    return r["localId"], r["idToken"]


def request(method, path, token=None, body=None):
    url = f"{DB}/{path}.json?ns={NS}" + (f"&auth={token}" if token else "")
    r = urllib.request.Request(url, data=None if body is None else json.dumps(body).encode(), method=method)
    try:
        urllib.request.urlopen(r).read()
        return OK
    except urllib.error.HTTPError as e:
        return DENIED if e.code in (401, 403) else f"ERRORE {e.code}"


def admin_put(path, body):
    r = urllib.request.Request(f"{DB}/{path}.json?ns={NS}", data=json.dumps(body).encode(), method="PUT",
                               headers={"Authorization": "Bearer owner"})
    urllib.request.urlopen(r).read()


def main():
    a, ta = new_user("rules-a@test.dev")
    b, tb = new_user("rules-b@test.dev")
    ios = {"productId": "splixy_monthly", "serverVerificationData": "JWS", "status": "purchased"}
    tests = [
        ("profilo: nickname proprio", OK, lambda: request("PUT", f"users/{a}/displayName", ta, "Mario Rossi")),
        ("profilo: scritture normali dell'app", OK, lambda: request("PATCH", f"users/{a}", ta, {"a": "010203", "privacy": "x", "app": {"wc": 3}, "ios": {"sub": None}})),
        ("profilo di un altro utente", DENIED, lambda: request("PUT", f"users/{b}/displayName", ta, "hack")),
        ("diventare super utente (su: true)", DENIED, lambda: request("PUT", f"users/{a}/su", ta, True)),
        ("su: false resta consentito", OK, lambda: request("PUT", f"users/{a}/su", ta, False)),
        ("auto-assegnarsi subData/role=pro", DENIED, lambda: request("PUT", f"users/{a}/subData/role", ta, "pro")),
        ("auto-assegnarsi un intero subData", DENIED, lambda: request("PUT", f"users/{a}/subData", ta, {"role": "pro", "status": "active", "expireAt": 9999999999999, "platform": "ios"})),
        ("auto-assegnarsi sub/ios=pro", DENIED, lambda: request("PUT", f"users/{a}/sub/ios", ta, "pro")),
        ("auto-assegnarsi sub/android=pro", DENIED, lambda: request("PUT", f"users/{a}/sub/android", ta, "pro")),
        ("intero utente con subData pro", DENIED, lambda: request("PUT", f"users/{a}", ta, {"displayName": "x", "subData": {"role": "pro", "status": "active"}})),
        ("transazione propria ios", OK, lambda: request("PUT", f"subscriptions/{a}/ios/p1", ta, ios)),
        ("transazione propria android", OK, lambda: request("PUT", f"subscriptions/{a}/android/t1", ta, {"productId": "splixy_monthly_01", "serverVerificationData": "TOKEN"})),
        ("piattaforma sconosciuta", DENIED, lambda: request("PUT", f"subscriptions/{a}/windows/p1", ta, ios)),
        ("senza serverVerificationData", DENIED, lambda: request("PUT", f"subscriptions/{a}/ios/p2", ta, {"productId": "x"})),
        ("transazione enorme", DENIED, lambda: request("PUT", f"subscriptions/{a}/ios/p3", ta, {"productId": "x", "serverVerificationData": "x" * 20001})),
        ("transazione di un altro utente", DENIED, lambda: request("PUT", f"subscriptions/{b}/ios/p1", ta, ios)),
        ("leggere le proprie transazioni", OK, lambda: request("GET", f"subscriptions/{a}", ta)),
        ("leggere le transazioni di un altro", DENIED, lambda: request("GET", f"subscriptions/{b}", ta)),
        ("scrivere subscriptionVerifications", DENIED, lambda: request("PUT", f"subscriptionVerifications/{a}/ios/p1", ta, {"status": "verified"})),
        ("leggere subscriptionVerifications", DENIED, lambda: request("GET", f"subscriptionVerifications/{a}", ta)),
        ("scrivere purchaseIndex", DENIED, lambda: request("PUT", "purchaseIndex/ios_x", ta, a)),
        ("leggere purchaseIndex", DENIED, lambda: request("GET", "purchaseIndex", ta)),
        ("scrivere activeSubscriptions", DENIED, lambda: request("PUT", f"activeSubscriptions/{a}", ta, 9999999999999)),
    ]
    # utente b abbonato (subData scritto dal server)
    admin_put(f"users/{b}/subData", {"role": "pro", "status": "active", "platform": "ios", "expireAt": 4102444800000, "txId": "1", "verifiedAt": 1})
    tests += [
        ("[abbonato] cambiare il nickname", OK, lambda: request("PUT", f"users/{b}/displayName", tb, "Nuovo Nome")),
        ("[abbonato] allungare la scadenza", DENIED, lambda: request("PUT", f"users/{b}/subData/expireAt", tb, 4999999999999)),
        ("[abbonato] cambiare la piattaforma", DENIED, lambda: request("PUT", f"users/{b}/subData/platform", tb, "android")),
        ("[abbonato] cambiare txId", DENIED, lambda: request("PUT", f"users/{b}/subData/txId", tb, "2")),
        ("[abbonato] cancellare subData", DENIED, lambda: request("DELETE", f"users/{b}/subData", tb)),
        ("[abbonato] rinunciare a Pro (role=free)", OK, lambda: request("PUT", f"users/{b}/subData/role", tb, "free")),
    ]
    failed = 0
    for desc, expected, action in tests:
        got = action()
        failed += got != expected
        print(("✓" if got == expected else "✗"), f"{desc:48} atteso {expected:7} ottenuto {got}")
    print("\nRISULTATO:", "tutti corretti" if not failed else f"{failed} difformi")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
