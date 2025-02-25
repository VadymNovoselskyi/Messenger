<script lang="ts">
	import { login, signup } from '$lib/api.svelte';

	let signupSelected: boolean = false;
	const nameRegex = /[A-Za-z]{3, 20}/;
</script>

<div id="wrapper" class:signupSelected>
	<div
		id="login"
		role="none"
		class:inactive={signupSelected}
		onmouseover={() => (signupSelected = false)}
		onfocus={() => (signupSelected = false)}
	>
		<h1 class="title">Login</h1>
		<form action="" onsubmit={login}>
			<label for="username">Username</label>
			<input
				type="text"
				id="usernameLogin"
				placeholder="Username"
				maxlength="25"
				autocomplete="username"
				required
			/>

			<label for="password">Password</label>
			<input type="password" id="passwordLogin" placeholder="Password" maxlength="64" required />

			<button type="submit">Login</button>
		</form>
	</div>

	<div
		id="signup"
		role="none"
		class:inactive={!signupSelected}
		onmouseover={() => (signupSelected = true)}
		onfocus={() => (signupSelected = true)}
	>
		<h1 class="title">Signup</h1>
		<form action="" onsubmit={signup}>
			<label for="username">Username</label>
			<input
				type="text"
				id="usernameSignup"
				placeholder="Username"
				maxlength="25"
				autocomplete="username"
				required
			/>

			<label for="password">Password</label>
			<input type="password" id="passwordSignup" placeholder="Password" maxlength="64" required />

			<button type="submit">Signup</button>
		</form>
	</div>
</div>

<style lang="scss">
	#wrapper {
		display: grid;
		grid-template-columns: 55fr 45fr;
		transition: grid-template-columns 0.4s ease;

		&.signupSelected {
			grid-template-columns: 45fr 55fr;
		}

		#login,
		#signup {
			padding: 4rem 6rem;
			transition: background-color 0.4s ease;

			form {
				display: grid;
				transition: opacity 0.4s ease;
				font-size: 1.2rem;

				label {
					padding-top: 4rem;
					padding-bottom: 0.1rem;
					display: block;
				}

				input {
					padding: 0.6rem 0.4rem;
					border-radius: 0.8rem;
					border: 1px solid transparent;
				}

				button[type='submit'] {
					border: 1px solid #8f97a0;
					border-radius: 4rem;
					background: linear-gradient(45deg, #a6adb5 0%, #5d6769 100%);

					font-size: 1.4rem;
					margin-top: 4rem;
					padding: 1rem 2rem;
				}
			}
		}

		#login {
			grid-column: 1;
			background-color: var(--primary-bg-color);
			color: var(--primary-text-color);

			&.inactive {
				background-color: #fdfffc;
				form {
					opacity: 0;
				}
			}
		}

		#signup {
			grid-column: 2;
			background-color: var(--secondary-bg-color);
			color: var(--secondary-text-color);

			&.inactive {
				background-color: #011627;
				form {
					opacity: 0;
				}
			}
		}
	}
</style>
