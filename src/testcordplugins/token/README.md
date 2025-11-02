# Token Display Plugin

Ce plugin ajoute une commande slash `/mytoken` qui permet d'afficher le token du compte Discord en cours d'utilisation.

## Fonctionnalités

- **Commande slash `/mytoken`** : Affiche le token du compte connecté
- **Réponse privée** : Le token est affiché uniquement pour vous (ephemeral)
- **Paramètres configurables** :
  - Activer/désactiver la commande
  - Autoriser l'utilisation dans les messages privés (DMs)

## Installation

1. Placez le dossier `@token` dans votre répertoire de plugins Vencord
2. Redémarrez Vencord ou rechargez les plugins
3. Activez le plugin dans les paramètres

## Utilisation

1. Tapez `/mytoken` dans n'importe quel canal Discord
2. Le token de votre compte sera affiché dans une réponse privée
3. ⚠️ **Important** : Ne partagez jamais votre token avec d'autres personnes !

## Paramètres

- **Activer la commande /mytoken** : Active ou désactive la commande
- **Permettre l'utilisation dans les DMs** : Autorise l'utilisation de la commande dans les messages privés

## Sécurité

- Le token est affiché uniquement pour vous (réponse ephemeral)
- Un avertissement de sécurité est inclus dans la réponse
- La commande peut être désactivée à tout moment

## Dépannage

Si la commande ne fonctionne pas :
1. Vérifiez que le plugin est activé
2. Assurez-vous d'être connecté à Discord
3. Vérifiez les paramètres du plugin
4. Redémarrez Vencord si nécessaire

## Avertissement

Ce plugin affiche des informations sensibles (token d'authentification). Utilisez-le avec précaution et ne partagez jamais votre token avec d'autres personnes.
